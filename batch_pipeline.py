"""batch_pipeline.py — 例文バッチJSON → Polly 3言語音声 → Supabase Storage → study_items INSERT

使い方:
    python batch_pipeline.py batch_001.json

必要パッケージ:
    pip install boto3 requests

.env（このファイルと同じフォルダに置く）:
    AWS_ACCESS_KEY_ID=...
    AWS_SECRET_ACCESS_KEY=...
    AWS_REGION_NAME=ap-northeast-1
    SUPABASE_URL=https://<project-ref>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...        # Settings→API の service_role（anonでは書き込み不可）
    SUPABASE_BUCKET=audio                # Public バケットであること
    POLLY_ENGINE=neural                  # neural 推奨（standard も可）
    POLLY_VOICE_JA=Kazuha                # 日本語: Kazuha / Tomoko / Takumi
    POLLY_VOICE_EN=Joanna                # 英語:   Joanna / Ruth / Matthew
    POLLY_VOICE_KO=Seoyeon               # 韓国語: Seoyeon

バッチJSONの形式（配列、1バッチ5件程度を想定）:
[
  {
    "ja_text": "ありがとうございます",
    "ko_text": "감사합니다",
    "en_text": "thank you",
    "ipa": "kam.sa.ham.ni.da",
    "ja_ipa": "a.ɾi.ga.toː.go.za.i.ma.s",
    "en_ipa": "ˈθæŋ.kjuː",
    "en_syllables": "thank·you"
  }
]

挙動:
- ko_text が既にDBに存在する行はスキップ（重複投入防止）
- 音声ファイル名は uuid ベース（<uuid>_ja.mp3 等）。Storage パスは ja/ en/ ko/ に振り分け
- 1件でも失敗したらその項目はDBに入れない（音声3本すべて成功した項目のみINSERT）
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from contextlib import closing
from pathlib import Path
from urllib.parse import quote

import boto3
import requests

APP_DIR = Path(__file__).resolve().parent
ENV_FILE = APP_DIR / ".env"

REQUIRED_FIELDS = ("ja_text", "ko_text", "en_text", "ipa", "ja_ipa", "en_ipa", "en_syllables")

LANGS = (
    # (jsonのテキストキー, 言語コード, Polly LanguageCode, ボイス環境変数, 既定ボイス)
    ("ja_text", "ja", "ja-JP", "POLLY_VOICE_JA", "Kazuha"),
    ("en_text", "en", "en-US", "POLLY_VOICE_EN", "Joanna"),
    ("ko_text", "ko", "ko-KR", "POLLY_VOICE_KO", "Seoyeon"),
)


def load_env_file(path: Path = ENV_FILE) -> None:
    """KEY=VALUE 形式の .env を読み込む（python-dotenv 不要、既存GUI版と同方式）"""
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip("'\"")
        if key and value and key not in os.environ:
            os.environ[key] = value


def require_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        sys.exit(f"エラー: 環境変数 {name} が未設定です（.env を確認）")
    return value


def synthesize(polly, text: str, lang_code: str, voice: str, engine: str) -> bytes:
    response = polly.synthesize_speech(
        Text=text,
        TextType="text",
        OutputFormat="mp3",
        VoiceId=voice,
        Engine=engine,
        LanguageCode=lang_code,
    )
    stream = response.get("AudioStream")
    if stream is None:
        raise RuntimeError("Polly が音声ストリームを返しませんでした")
    with closing(stream) as s:
        return s.read()


def storage_upload(supabase_url: str, service_key: str, bucket: str, path: str, data: bytes) -> str:
    """Storageへアップロードし、公開URLを返す"""
    url = f"{supabase_url}/storage/v1/object/{bucket}/{path}"
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "audio/mpeg",
            "x-upsert": "true",
        },
        data=data,
        timeout=60,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Storageアップロード失敗 ({resp.status_code}): {resp.text[:200]}")
    return f"{supabase_url}/storage/v1/object/public/{bucket}/{path}"


def row_exists(supabase_url: str, service_key: str, ko_text: str) -> bool:
    resp = requests.get(
        f"{supabase_url}/rest/v1/study_items",
        params={"ko_text": f"eq.{ko_text}", "select": "id"},
        headers={"apikey": service_key, "Authorization": f"Bearer {service_key}"},
        timeout=30,
    )
    resp.raise_for_status()
    return len(resp.json()) > 0


def insert_row(supabase_url: str, service_key: str, row: dict) -> None:
    resp = requests.post(
        f"{supabase_url}/rest/v1/study_items",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=row,
        timeout=30,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"INSERT失敗 ({resp.status_code}): {resp.text[:200]}")


def validate_item(item: dict, index: int) -> list[str]:
    problems = []
    for field in REQUIRED_FIELDS:
        if not str(item.get(field, "")).strip():
            problems.append(f"  [{index}] {field} が空です")
    # 韓国語IPAの音節数とハングル音節数の一致チェック（TRANSCRIPTION_RULES.md の原則）
    ko = item.get("ko_text", "")
    ipa = item.get("ipa", "")
    if ko and ipa:
        hangul_syllables = sum(1 for ch in ko if "가" <= ch <= "힣")
        ipa_syllables = len([s for s in ipa.split(".") if s])
        if hangul_syllables != ipa_syllables:
            problems.append(
                f"  [{index}] 音節数不一致: ハングル {hangul_syllables} 音節 vs ipa {ipa_syllables} 音節"
                f"（{ko} / {ipa}）"
            )
    return problems


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("使い方: python batch_pipeline.py <batch.json>")

    load_env_file()
    require_env("AWS_ACCESS_KEY_ID")
    require_env("AWS_SECRET_ACCESS_KEY")
    region = os.environ.get("AWS_REGION_NAME", "ap-northeast-1")
    supabase_url = require_env("SUPABASE_URL").rstrip("/")
    service_key = require_env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = os.environ.get("SUPABASE_BUCKET", "audio")
    engine = os.environ.get("POLLY_ENGINE", "neural")

    batch_path = Path(sys.argv[1])
    if not batch_path.exists():
        sys.exit(f"エラー: {batch_path} が見つかりません")

    items = json.loads(batch_path.read_text(encoding="utf-8-sig"))
    if not isinstance(items, list) or not items:
        sys.exit("エラー: JSONは1件以上の配列である必要があります")

    # ---- 事前検証（1件でも問題があれば何も実行せず終了 = 検品ゲート）----
    all_problems: list[str] = []
    for i, item in enumerate(items, start=1):
        all_problems.extend(validate_item(item, i))
    if all_problems:
        print("バッチに問題があります。修正してから再実行してください:")
        print("\n".join(all_problems))
        sys.exit(1)

    polly = boto3.client("polly", region_name=region)

    inserted = 0
    skipped = 0
    failed = 0

    for i, item in enumerate(items, start=1):
        ko_text = item["ko_text"].strip()
        label = f"({i}/{len(items)}) {ko_text}"

        try:
            if row_exists(supabase_url, service_key, ko_text):
                print(f"{label}: 既にDBに存在 → スキップ")
                skipped += 1
                continue

            item_id = uuid.uuid4().hex[:12]
            urls: dict[str, str] = {}

            for text_key, lang, lang_code, voice_env, default_voice in LANGS:
                voice = os.environ.get(voice_env, default_voice)
                audio = synthesize(polly, item[text_key].strip(), lang_code, voice, engine)
                path = f"{lang}/{item_id}_{lang}.mp3"
                urls[lang] = storage_upload(supabase_url, service_key, bucket, path, audio)
                print(f"{label}: {lang} 音声OK ({voice})")

            insert_row(
                supabase_url,
                service_key,
                {
                    "ja_text": item["ja_text"].strip(),
                    "ko_text": ko_text,
                    "en_text": item["en_text"].strip(),
                    "ipa": item["ipa"].strip(),
                    "ja_ipa": item["ja_ipa"].strip(),
                    "en_ipa": item["en_ipa"].strip(),
                    "en_syllables": item["en_syllables"].strip(),
                    "ja_audio_url": urls["ja"],
                    "en_audio_url": urls["en"],
                    "ko_audio_url": urls["ko"],
                },
            )
            print(f"{label}: DB追加完了")
            inserted += 1

        except Exception as exc:
            print(f"{label}: 失敗 - {exc}")
            failed += 1

    print(f"\n完了: 追加 {inserted} / スキップ {skipped} / 失敗 {failed}")


if __name__ == "__main__":
    main()
