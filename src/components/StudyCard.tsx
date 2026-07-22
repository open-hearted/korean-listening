// IPA表示と操作ボタンを持つ学習カード（答えとなるテキストは表示しない）
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStudySession } from "@/lib/hooks/useStudySession";
import { createClient } from "@/lib/supabase/client";
import { SupabaseInsightRepository } from "@/lib/repository/insightRepository";
import { SupabaseAiQuestionRepository } from "@/lib/repository/aiQuestionRepository";
import type { AiQuestion, Insight, StudyItem } from "@/lib/repository/types";
import { toLiteralIpa } from "@/lib/korean/koLiteralIpa";
import {
  detectSoundChangeArrows,
  diffSyllablePhonemes,
} from "@/lib/korean/soundChangeAnalysis";

function formatDateTimeMinute(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function StudyCard() {
  const { currentItem, phase, errorMessage, start, repeat, next, playSingle } =
    useStudySession();

  const isBusy = phase === "loading" || phase === "playing";
  const hasStarted = currentItem !== null;

  return (
    <div className="flex w-full flex-1 flex-col md:flex-row">
      {/* 操作エリア: モバイルではsticky固定、md以上では通常表示 */}
      <div className="sticky top-0 z-10 flex flex-col items-center gap-6 bg-white px-4 py-4 text-center md:static md:w-[440px] md:shrink-0 md:border-r md:border-gray-200 md:px-6 md:py-6">
        <div className="flex min-h-[8rem] w-full flex-col items-center justify-center gap-3">
          {currentItem ? (
            // currentItem.id を key にすることで、問題が変わるたびにハングル表示状態がリセットされる
            <StudyItemDisplay
              key={currentItem.id}
              item={currentItem}
              isBusy={isBusy}
              onPlaySingle={playSingle}
            />
          ) : (
            <p className="text-lg text-gray-500">
              「▶ 開始」を押して学習を始めてください
            </p>
          )}
        </div>

        {errorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="flex w-full max-w-xs flex-col gap-3">
          {!hasStarted ? (
            <button
              type="button"
              onClick={() => void start()}
              disabled={isBusy}
              className="rounded-full bg-blue-600 px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
            >
              ▶ 開始
            </button>
          ) : (
            <div className="flex w-full items-stretch gap-2">
              <button
                type="button"
                onClick={() => void repeat()}
                disabled={isBusy}
                className="flex-1 rounded-full bg-gray-200 px-4 py-3 text-base font-semibold text-gray-800 disabled:opacity-50"
              >
                🔁 リピート
              </button>
              <button
                type="button"
                onClick={() => void next()}
                disabled={isBusy}
                className="flex-[2] rounded-full bg-blue-600 px-6 py-4 text-lg font-semibold text-white disabled:opacity-50"
              >
                ▶ 次へ
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 記録エリア: この例文についてのAI質問・気付きメモを常時表示。md以上では独立してスクロールする */}
      <div className="flex w-full flex-1 flex-col gap-8 px-4 py-6 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:px-6">
        {currentItem && (
          <>
            <AskAiSection key={currentItem.id} item={currentItem} />
            <InsightSection key={currentItem.id} item={currentItem} />
          </>
        )}
      </div>
    </div>
  );
}

function StudyItemDisplay({
  item,
  isBusy,
  onPlaySingle,
}: {
  item: StudyItem;
  isBusy: boolean;
  onPlaySingle: (url: string, playType: "ja" | "en" | "ko") => Promise<void>;
}) {
  const [showHangul, setShowHangul] = useState(false);
  const [showEnSyllables, setShowEnSyllables] = useState(false);
  const [showSoundChange, setShowSoundChange] = useState(false);
  const [showIpa, setShowIpa] = useState(true);

  const enAudioUrl = item.enAudioUrl;

  const hangulSyllables = useMemo(() => Array.from(item.koText), [item.koText]);
  const literalSyllables = useMemo(
    () => toLiteralIpa(item.koText).split("."),
    [item.koText]
  );
  const actualSyllables = useMemo(() => item.ipa.split("."), [item.ipa]);
  const syllablesAlign = literalSyllables.length === actualSyllables.length;
  const hangulAligns = hangulSyllables.length === literalSyllables.length;

  const arrows = useMemo(
    () =>
      syllablesAlign
        ? detectSoundChangeArrows(literalSyllables, actualSyllables)
        : [],
    [syllablesAlign, literalSyllables, actualSyllables]
  );

  return (
    <>
      <div
        className={`flex w-full flex-col items-center gap-3${showIpa ? "" : " invisible"}`}
        aria-hidden={!showIpa}
      >
        {item.jaIpa && (
          <IpaLine
            text={item.jaIpa}
            audioUrl={item.jaAudioUrl}
            playType="ja"
            isBusy={isBusy}
            onPlaySingle={onPlaySingle}
            textClassName="break-words text-2xl text-gray-500 sm:text-3xl"
          />
        )}
        {item.enIpa && (
          <IpaLine
            text={item.enIpa}
            audioUrl={item.enAudioUrl}
            playType="en"
            isBusy={isBusy}
            onPlaySingle={onPlaySingle}
            textClassName="break-words text-3xl font-semibold sm:text-4xl"
          />
        )}
        <IpaLine
          text={item.ipa}
          audioUrl={item.koAudioUrl}
          playType="ko"
          isBusy={isBusy}
          onPlaySingle={onPlaySingle}
          textClassName="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl"
        />
      </div>

      {!showIpa && (
        <div className="flex justify-center gap-3">
          {item.jaIpa && (
            <button
              type="button"
              onClick={() => void onPlaySingle(item.jaAudioUrl, "ja")}
              disabled={isBusy}
              aria-label="日本語の音声を再生"
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
            >
              🔊 日
            </button>
          )}
          {item.enIpa && enAudioUrl && (
            <button
              type="button"
              onClick={() => void onPlaySingle(enAudioUrl, "en")}
              disabled={isBusy}
              aria-label="英語の音声を再生"
              className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
            >
              🔊 英
            </button>
          )}
          <button
            type="button"
            onClick={() => void onPlaySingle(item.koAudioUrl, "ko")}
            disabled={isBusy}
            aria-label="韓国語の音声を再生"
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 disabled:opacity-40"
          >
            🔊 韓
          </button>
        </div>
      )}

      <div className="flex min-h-[10rem] w-full flex-col items-center justify-center gap-2">
        {showSoundChange ? (
          <SoundChangeGrid
            hangulSyllables={hangulAligns ? hangulSyllables : null}
            literalSyllables={literalSyllables}
            actualSyllables={actualSyllables}
            syllablesAlign={syllablesAlign}
            arrows={arrows}
          />
        ) : (
          showHangul && (
            <p className="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl">
              {item.koText}
            </p>
          )
        )}
        {showEnSyllables && item.enSyllables && (
          <p className="break-words text-2xl tracking-wide text-gray-700 sm:text-3xl">
            {item.enSyllables}
          </p>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={() => setShowIpa((prev) => !prev)}
          className="text-sm font-medium text-gray-500 underline"
        >
          {showIpa ? "IPAを隠す" : "IPAを表示"}
        </button>
        <button
          type="button"
          onClick={() => setShowHangul((prev) => !prev)}
          className="text-sm font-medium text-gray-500 underline"
        >
          {showHangul ? "ハングルを隠す" : "ハングルを表示"}
        </button>
        <button
          type="button"
          onClick={() => setShowEnSyllables((prev) => !prev)}
          disabled={!item.enSyllables}
          className="text-sm font-medium text-gray-500 underline disabled:cursor-not-allowed disabled:text-gray-300 disabled:no-underline"
        >
          {showEnSyllables ? "英語スペルを隠す" : "英語スペルを表示"}
        </button>
        <button
          type="button"
          onClick={() => setShowSoundChange((prev) => !prev)}
          className="text-sm font-medium text-gray-500 underline"
        >
          {showSoundChange ? "音変化を隠す" : "音変化を表示"}
        </button>
      </div>
    </>
  );
}

function AskAiSection({ item }: { item: StudyItem }) {
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [history, setHistory] = useState<AiQuestion[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);

  const repositoryRef = useRef<SupabaseAiQuestionRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new SupabaseAiQuestionRepository(createClient());
  }

  const loadHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const list = await repositoryRef.current!.list(item.id);
      setHistory(list);
    } catch {
      // 履歴の取得失敗は質問機能自体を止めない
    } finally {
      setIsLoadingHistory(false);
    }
  }, [item.id]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          studyItemId: item.id,
          context: {
            ipa: item.ipa,
            jaIpa: item.jaIpa,
            enIpa: item.enIpa,
            koText: item.koText,
            jaText: item.jaText,
            enText: item.enText,
          },
        }),
      });

      const data: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof data === "object" && data !== null && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "AIへの問い合わせに失敗しました。";
        setErrorMessage(message);
        return;
      }

      setQuestion("");
      await loadHistory();
    } catch {
      setErrorMessage("AIへの問い合わせに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <h2 className="text-sm font-semibold text-gray-700">AIに質問</h2>
      <textarea
        value={question}
        onChange={(event) => setQuestion(event.target.value)}
        disabled={isLoading}
        placeholder="この例文について質問する"
        rows={2}
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => void handleAsk()}
        disabled={isLoading || question.trim() === ""}
        className="self-end rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isLoading ? "質問中…" : "質問する"}
      </button>

      {errorMessage && (
        <p className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {isLoadingHistory ? (
          <p className="text-sm text-gray-400">読み込み中…</p>
        ) : history.length === 0 ? (
          <p className="text-sm text-gray-400">まだ質問がありません</p>
        ) : (
          history.map((qa) => (
            <div key={qa.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-400">{formatDateTimeMinute(qa.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm font-medium text-gray-800">
                Q: {qa.question}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">A: {qa.answer}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InsightSection({ item }: { item: StudyItem }) {
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);

  const repositoryRef = useRef<SupabaseInsightRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new SupabaseInsightRepository(createClient());
  }

  const loadInsights = useCallback(async () => {
    setIsLoadingList(true);
    try {
      const list = await repositoryRef.current!.list(item.id);
      setInsights(list);
    } catch {
      setErrorMessage("気付きの取得に失敗しました。");
    } finally {
      setIsLoadingList(false);
    }
  }, [item.id]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const handleSave = async () => {
    const trimmed = note.trim();
    if (!trimmed || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);
    setSaveMessage(null);

    try {
      await repositoryRef.current!.save(item.id, trimmed);
      setNote("");
      setSaveMessage("保存しました");
      await loadInsights();
    } catch {
      setErrorMessage("保存に失敗しました。");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="flex w-full flex-col gap-3 text-left">
      <h2 className="text-sm font-semibold text-gray-700">気付きメモ</h2>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        disabled={isSaving}
        placeholder="この例文についての気付きをメモする"
        rows={3}
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving || note.trim() === ""}
        className="self-end rounded-full bg-gray-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {isSaving ? "保存中…" : "保存"}
      </button>

      <div className="min-h-[1.25rem]">
        {errorMessage && (
          <p className="text-sm text-red-600" role="alert">
            {errorMessage}
          </p>
        )}
        {!errorMessage && saveMessage && (
          <p className="text-sm text-green-600">{saveMessage}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {isLoadingList ? (
          <p className="text-sm text-gray-400">読み込み中…</p>
        ) : insights.length === 0 ? (
          <p className="text-sm text-gray-400">まだ記録がありません</p>
        ) : (
          insights.map((insight) => (
            <div key={insight.id} className="rounded-lg bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-400">{formatDateTimeMinute(insight.createdAt)}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{insight.note}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function IpaLine({
  text,
  audioUrl,
  playType,
  isBusy,
  onPlaySingle,
  textClassName,
}: {
  text: string;
  audioUrl: string | null;
  playType: "ja" | "en" | "ko";
  isBusy: boolean;
  onPlaySingle: (url: string, playType: "ja" | "en" | "ko") => Promise<void>;
  textClassName: string;
}) {
  return (
    <div className="flex w-full items-center justify-center gap-1">
      {audioUrl && <div className="h-11 w-11 shrink-0" aria-hidden="true" />}
      <p className={textClassName}>{text}</p>
      {audioUrl && (
        <button
          type="button"
          onClick={() => void onPlaySingle(audioUrl, playType)}
          disabled={isBusy}
          aria-label="この言語の音声を再生"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg text-gray-400 hover:text-gray-600 disabled:opacity-40"
        >
          🔊
        </button>
      )}
    </div>
  );
}

const COLUMN_WIDTH_PX = 56;

function SoundChangeGrid({
  hangulSyllables,
  literalSyllables,
  actualSyllables,
  syllablesAlign,
  arrows,
}: {
  hangulSyllables: string[] | null;
  literalSyllables: string[];
  actualSyllables: string[];
  syllablesAlign: boolean;
  arrows: SoundChangeArrowType[];
}) {
  const columnCount = Math.max(literalSyllables.length, actualSyllables.length);
  const gridWidth = columnCount * COLUMN_WIDTH_PX;

  return (
    <div className="flex flex-col items-center gap-1">
      {hangulSyllables && (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${hangulSyllables.length}, ${COLUMN_WIDTH_PX}px)`,
          }}
        >
          {hangulSyllables.map((syllable, index) => (
            <span
              key={index}
              className="text-center text-3xl font-bold tracking-wide sm:text-4xl"
            >
              {syllable}
            </span>
          ))}
        </div>
      )}

      <div className="relative" style={{ width: gridWidth }}>
        {syllablesAlign && arrows.length > 0 && (
          <SoundChangeArrows arrows={arrows} columnCount={columnCount} />
        )}
        <PhonemeRow
          syllables={literalSyllables}
          compareSyllables={syllablesAlign ? actualSyllables : null}
          role="literal"
        />
        <PhonemeRow
          syllables={actualSyllables}
          compareSyllables={syllablesAlign ? literalSyllables : null}
          role="actual"
        />
      </div>
    </div>
  );
}

type SoundChangeArrowType = { fromSyllableIndex: number; toSyllableIndex: number };

function SoundChangeArrows({
  arrows,
  columnCount,
}: {
  arrows: SoundChangeArrowType[];
  columnCount: number;
}) {
  const height = 20;
  const width = columnCount * COLUMN_WIDTH_PX;

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 -translate-y-full"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      {arrows.map((arrow, index) => {
        const fromX = arrow.fromSyllableIndex * COLUMN_WIDTH_PX + COLUMN_WIDTH_PX / 2;
        const toX = arrow.toSyllableIndex * COLUMN_WIDTH_PX + COLUMN_WIDTH_PX / 2;
        const midX = (fromX + toX) / 2;
        return (
          <path
            key={index}
            d={`M ${fromX} ${height} Q ${midX} 0 ${toX} ${height}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="text-gray-400"
            markerEnd={`url(#arrowhead-${index})`}
          />
        );
      })}
      <defs>
        {arrows.map((_, index) => (
          <marker
            key={index}
            id={`arrowhead-${index}`}
            markerWidth={6}
            markerHeight={6}
            refX={5}
            refY={3}
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" className="fill-gray-400" />
          </marker>
        ))}
      </defs>
    </svg>
  );
}

function PhonemeRow({
  syllables,
  compareSyllables,
  role,
}: {
  syllables: string[];
  compareSyllables: string[] | null;
  role: "literal" | "actual";
}) {
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${syllables.length}, ${COLUMN_WIDTH_PX}px)`,
      }}
    >
      {syllables.map((syllable, index) => {
        const compareSyllable = compareSyllables?.[index] ?? null;
        const { clusters, changed } =
          compareSyllable !== null
            ? role === "literal"
              ? diffSyllablePhonemes(syllable, compareSyllable).literalDiff
              : diffSyllablePhonemes(compareSyllable, syllable).actualDiff
            : { clusters: Array.from(syllable), changed: Array.from(syllable).map(() => false) };

        return (
          <span
            key={index}
            className="text-center text-lg font-semibold text-gray-500 sm:text-xl"
          >
            {clusters.map((cluster, clusterIndex) => (
              <span
                key={clusterIndex}
                className={changed[clusterIndex] ? "text-red-600" : undefined}
              >
                {cluster}
              </span>
            ))}
          </span>
        );
      })}
    </div>
  );
}
