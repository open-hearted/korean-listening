// IPA表示と操作ボタンを持つ学習カード（答えとなるテキストは表示しない）
"use client";

import { useState } from "react";
import { useStudySession } from "@/lib/hooks/useStudySession";
import type { StudyItem } from "@/lib/repository/types";
import { toLiteralIpa } from "@/lib/korean/koLiteralIpa";

export function StudyCard() {
  const { currentItem, phase, errorMessage, start, repeat, next } =
    useStudySession();

  const isBusy = phase === "loading" || phase === "playing";
  const hasStarted = currentItem !== null;

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex min-h-[8rem] w-full flex-col items-center justify-center gap-3">
        {currentItem ? (
          // currentItem.id を key にすることで、問題が変わるたびにハングル表示状態がリセットされる
          <StudyItemDisplay key={currentItem.id} item={currentItem} />
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
          <>
            <button
              type="button"
              onClick={() => void repeat()}
              disabled={isBusy}
              className="rounded-full bg-gray-200 px-6 py-3 text-lg font-semibold text-gray-800 disabled:opacity-50"
            >
              🔁 リピート
            </button>
            <button
              type="button"
              onClick={() => void next()}
              disabled={isBusy}
              className="rounded-full bg-blue-600 px-6 py-3 text-lg font-semibold text-white disabled:opacity-50"
            >
              ▶ 次へ
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function StudyItemDisplay({ item }: { item: StudyItem }) {
  const [showHangul, setShowHangul] = useState(false);
  const [showEnSyllables, setShowEnSyllables] = useState(false);
  const [showSoundChange, setShowSoundChange] = useState(false);

  const literalIpa = toLiteralIpa(item.koText);
  const literalSyllables = literalIpa.split(".");
  const actualSyllables = item.ipa.split(".");
  const syllablesAlign = literalSyllables.length === actualSyllables.length;

  return (
    <>
      {item.jaIpa && (
        <p className="break-words text-2xl text-gray-500 sm:text-3xl">
          {item.jaIpa}
        </p>
      )}
      {item.enIpa && (
        <p className="break-words text-3xl font-semibold sm:text-4xl">
          {item.enIpa}
        </p>
      )}
      <p className="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl">
        {item.ipa}
      </p>

      <div className="flex min-h-[8rem] w-full flex-col items-center justify-center gap-2">
        {showSoundChange && (
          <div className="flex flex-col items-center gap-1">
            <SyllableRow
              syllables={literalSyllables}
              compareTo={syllablesAlign ? actualSyllables : null}
              label="文字通り"
            />
            <SyllableRow
              syllables={actualSyllables}
              compareTo={syllablesAlign ? literalSyllables : null}
              label="実際"
            />
          </div>
        )}
        {showHangul && (
          <p className="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl">
            {item.koText}
          </p>
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

function SyllableRow({
  syllables,
  compareTo,
  label,
}: {
  syllables: string[];
  compareTo: string[] | null;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-right text-xs text-gray-400">
        {label}
      </span>
      <div className="flex gap-1">
        {syllables.map((syllable, index) => {
          const isDifferent =
            compareTo !== null && compareTo[index] !== syllable;
          return (
            <span
              key={index}
              className={`inline-block min-w-[2.5rem] text-center text-lg font-semibold sm:text-xl ${
                isDifferent ? "text-red-600" : "text-gray-500"
              }`}
            >
              {syllable}
            </span>
          );
        })}
      </div>
    </div>
  );
}
