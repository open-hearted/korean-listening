// ハングルを音韻規則（鼻音化・連音化・濃音化・激音化等）を適用せず、
// 音節ごとに独立変換した「文字通りのIPA」に変換するモジュール
// 例: toLiteralIpa("감사합니다") === "kam.sa.hap̚.ni.da"

const HANGUL_BASE = 0xac00;
const HANGUL_LAST = 0xd7a3;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

const CHOSEONG_MAP = [
  "k", // ㄱ
  "k͈", // ㄲ
  "n", // ㄴ
  "t", // ㄷ
  "t͈", // ㄸ
  "ɾ", // ㄹ
  "m", // ㅁ
  "p", // ㅂ
  "p͈", // ㅃ
  "s", // ㅅ
  "s͈", // ㅆ
  "", // ㅇ (無音)
  "tɕ", // ㅈ
  "t͈ɕ", // ㅉ
  "tɕʰ", // ㅊ
  "kʰ", // ㅋ
  "tʰ", // ㅌ
  "pʰ", // ㅍ
  "h", // ㅎ
];

const JUNGSEONG_MAP = [
  "a", // ㅏ
  "ɛ", // ㅐ
  "ja", // ㅑ
  "jɛ", // ㅒ
  "ʌ", // ㅓ
  "e", // ㅔ
  "jʌ", // ㅕ
  "je", // ㅖ
  "o", // ㅗ
  "wa", // ㅘ
  "wɛ", // ㅙ
  "we", // ㅚ
  "jo", // ㅛ
  "u", // ㅜ
  "wʌ", // ㅝ
  "we", // ㅞ
  "wi", // ㅟ
  "ju", // ㅠ
  "ɯ", // ㅡ
  "ɰi", // ㅢ
  "i", // ㅣ
];

const JONGSEONG_MAP = [
  "", // (終声なし)
  "k̚", // ㄱ
  "k̚", // ㄲ
  "k̚", // ㄳ
  "n", // ㄴ
  "n", // ㄵ
  "n", // ㄶ
  "t̚", // ㄷ
  "l", // ㄹ
  "l", // ㄺ
  "m", // ㄻ
  "l", // ㄼ
  "l", // ㄽ
  "l", // ㄾ
  "p̚", // ㄿ
  "l", // ㅀ
  "m", // ㅁ
  "p̚", // ㅂ
  "p̚", // ㅄ
  "t̚", // ㅅ
  "t̚", // ㅆ
  "ŋ", // ㅇ
  "t̚", // ㅈ
  "t̚", // ㅊ
  "k̚", // ㅋ
  "t̚", // ㅌ
  "p̚", // ㅍ
  "t̚", // ㅎ
];

function isHangulSyllable(codePoint: number): boolean {
  return codePoint >= HANGUL_BASE && codePoint <= HANGUL_LAST;
}

function syllableToIpa(codePoint: number): string {
  const offset = codePoint - HANGUL_BASE;
  const choseongIndex = Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT));
  const jungseongIndex = Math.floor(offset / JONGSEONG_COUNT) % JUNGSEONG_COUNT;
  const jongseongIndex = offset % JONGSEONG_COUNT;

  return (
    CHOSEONG_MAP[choseongIndex] +
    JUNGSEONG_MAP[jungseongIndex] +
    JONGSEONG_MAP[jongseongIndex]
  );
}

export function toLiteralIpa(hangul: string): string {
  const syllables: string[] = [];

  for (const char of hangul) {
    const codePoint = char.codePointAt(0);
    if (codePoint !== undefined && isHangulSyllable(codePoint)) {
      syllables.push(syllableToIpa(codePoint));
    }
  }

  return syllables.join(".");
}
