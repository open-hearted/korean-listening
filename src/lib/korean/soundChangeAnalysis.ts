// 音節ごとの「文字通り」と「実際」のIPAを比較し、変化した音素部分の特定と
// 変化の原因（隣接音節の音）を簡易ルールベースで推定するモジュール

export interface PhonemeDiff {
  /** 書記素クラスタ配列（結合文字を分離しない） */
  clusters: string[];
  /** 各クラスタが「変化した中間部分」に含まれるかどうか */
  changed: boolean[];
}

export interface SoundChangeArrow {
  /** 矢印の起点となる音節インデックス（原因側・文字通り行） */
  fromSyllableIndex: number;
  /** 矢印の終点となる音節インデックス（結果側・実際行） */
  toSyllableIndex: number;
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("en", { granularity: "grapheme" })
    : null;

function toGraphemeClusters(text: string): string[] {
  if (segmenter) {
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/**
 * literal と actual の書記素クラスタ列を比較し、共通接頭辞・共通接尾辞を除いた
 * 中間部分を「変化した音素」として両者にマークする
 */
export function diffSyllablePhonemes(
  literal: string,
  actual: string
): { literalDiff: PhonemeDiff; actualDiff: PhonemeDiff } {
  const literalClusters = toGraphemeClusters(literal);
  const actualClusters = toGraphemeClusters(actual);

  if (literal === actual) {
    return {
      literalDiff: {
        clusters: literalClusters,
        changed: literalClusters.map(() => false),
      },
      actualDiff: {
        clusters: actualClusters,
        changed: actualClusters.map(() => false),
      },
    };
  }

  let prefixLen = 0;
  const maxPrefix = Math.min(literalClusters.length, actualClusters.length);
  while (
    prefixLen < maxPrefix &&
    literalClusters[prefixLen] === actualClusters[prefixLen]
  ) {
    prefixLen++;
  }

  let suffixLen = 0;
  const maxSuffix = maxPrefix - prefixLen;
  while (
    suffixLen < maxSuffix &&
    literalClusters[literalClusters.length - 1 - suffixLen] ===
      actualClusters[actualClusters.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const literalChanged = literalClusters.map(
    (_, i) => i >= prefixLen && i < literalClusters.length - suffixLen
  );
  const actualChanged = actualClusters.map(
    (_, i) => i >= prefixLen && i < actualClusters.length - suffixLen
  );

  return {
    literalDiff: { clusters: literalClusters, changed: literalChanged },
    actualDiff: { clusters: actualClusters, changed: actualChanged },
  };
}

const NASALS = new Set(["n", "m"]);
const STOPS_TO_NASAL: Record<string, string> = {
  "p̚": "m",
  "t̚": "n",
  "k̚": "ŋ",
};
const ASPIRATED_PAIRS: Record<string, string> = {
  k: "kʰ",
  t: "tʰ",
  p: "pʰ",
  tɕ: "tɕʰ",
};

/**
 * 変化した音節から、原因と推定される隣接音節への矢印を簡易ルールベースで判定する。
 * 判定できない場合は矢印を生成しない（無理な推定はしない）。
 */
export function detectSoundChangeArrows(
  literalSyllables: string[],
  actualSyllables: string[]
): SoundChangeArrow[] {
  if (literalSyllables.length !== actualSyllables.length) {
    return [];
  }

  const arrows: SoundChangeArrow[] = [];

  for (let i = 0; i < literalSyllables.length; i++) {
    const literal = literalSyllables[i];
    const actual = actualSyllables[i];
    if (literal === actual) continue;

    const nextLiteral = literalSyllables[i + 1];
    const nextActual = actualSyllables[i + 1];
    const prevLiteral = literalSyllables[i - 1];

    // 鼻音化: 終声の平音破裂音(p̚/t̚/k̚) → 鼻音(m/n/ŋ)。原因は次音節の初声鼻音
    const nasalizedTo = STOPS_TO_NASAL[literal.slice(-2)];
    if (
      nasalizedTo &&
      actual.endsWith(nasalizedTo) &&
      nextLiteral !== undefined &&
      NASALS.has(nextLiteral[0])
    ) {
      arrows.push({ fromSyllableIndex: i + 1, toSyllableIndex: i });
      continue;
    }

    // 連音化: 終声(literal)が消え、次音節の実際の初声に現れる。原因は次音節の初声が ∅ (無声=母音始まり)
    if (nextLiteral !== undefined && nextActual !== undefined) {
      const literalCoda = literal.slice(prefixMatchLength(literal, actual));
      const nextIsVowelInitial = /^[aeiouɛʌɯɰwj]/.test(nextLiteral);
      if (
        literalCoda.length > 0 &&
        nextIsVowelInitial &&
        nextActual.startsWith(literalCoda) &&
        actual.length < literal.length
      ) {
        arrows.push({ fromSyllableIndex: i + 1, toSyllableIndex: i });
        continue;
      }
    }

    // 流音化: n → l。隣接する l が原因（前後どちらか）
    if (literal.includes("n") && actual.includes("l")) {
      if (nextLiteral !== undefined && nextLiteral.startsWith("l")) {
        arrows.push({ fromSyllableIndex: i + 1, toSyllableIndex: i });
        continue;
      }
      if (prevLiteral !== undefined && prevLiteral.endsWith("l")) {
        arrows.push({ fromSyllableIndex: i - 1, toSyllableIndex: i });
        continue;
      }
    }

    // 激音化: 平音 → 激音。隣接する h が原因（前後どちらか）
    const aspiratedFrom = Object.keys(ASPIRATED_PAIRS).find(
      (plain) => literal.startsWith(plain) && actual.startsWith(ASPIRATED_PAIRS[plain])
    );
    if (aspiratedFrom) {
      if (prevLiteral !== undefined && prevLiteral.endsWith("h")) {
        arrows.push({ fromSyllableIndex: i - 1, toSyllableIndex: i });
        continue;
      }
      if (nextLiteral !== undefined && nextLiteral.startsWith("h")) {
        arrows.push({ fromSyllableIndex: i + 1, toSyllableIndex: i });
        continue;
      }
    }
  }

  return arrows;
}

function prefixMatchLength(a: string, b: string): number {
  let len = 0;
  const max = Math.min(a.length, b.length);
  while (len < max && a[len] === b[len]) {
    len++;
  }
  return len;
}
