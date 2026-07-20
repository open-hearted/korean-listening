// IPA表示と操作ボタンを持つ学習カード（答えとなるテキストは表示しない）
"use client";

import { useMemo, useState } from "react";
import { useStudySession } from "@/lib/hooks/useStudySession";
import type { StudyItem } from "@/lib/repository/types";
import { toLiteralIpa } from "@/lib/korean/koLiteralIpa";
import {
  detectSoundChangeArrows,
  diffSyllablePhonemes,
} from "@/lib/korean/soundChangeAnalysis";

export function StudyCard() {
  const { currentItem, phase, errorMessage, start, repeat, next, playSingle } =
    useStudySession();

  const isBusy = phase === "loading" || phase === "playing";
  const hasStarted = currentItem !== null;

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 px-4 text-center">
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

function StudyItemDisplay({
  item,
  isBusy,
  onPlaySingle,
}: {
  item: StudyItem;
  isBusy: boolean;
  onPlaySingle: (url: string) => Promise<void>;
}) {
  const [showHangul, setShowHangul] = useState(false);
  const [showEnSyllables, setShowEnSyllables] = useState(false);
  const [showSoundChange, setShowSoundChange] = useState(false);

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
      {item.jaIpa && (
        <IpaLine
          text={item.jaIpa}
          audioUrl={item.jaAudioUrl}
          isBusy={isBusy}
          onPlaySingle={onPlaySingle}
          textClassName="break-words text-2xl text-gray-500 sm:text-3xl"
        />
      )}
      {item.enIpa && (
        <IpaLine
          text={item.enIpa}
          audioUrl={item.enAudioUrl}
          isBusy={isBusy}
          onPlaySingle={onPlaySingle}
          textClassName="break-words text-3xl font-semibold sm:text-4xl"
        />
      )}
      <IpaLine
        text={item.ipa}
        audioUrl={item.koAudioUrl}
        isBusy={isBusy}
        onPlaySingle={onPlaySingle}
        textClassName="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl"
      />

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

function IpaLine({
  text,
  audioUrl,
  isBusy,
  onPlaySingle,
  textClassName,
}: {
  text: string;
  audioUrl: string | null;
  isBusy: boolean;
  onPlaySingle: (url: string) => Promise<void>;
  textClassName: string;
}) {
  return (
    <div className="flex w-full items-center justify-center gap-1">
      {audioUrl && <div className="h-11 w-11 shrink-0" aria-hidden="true" />}
      <p className={textClassName}>{text}</p>
      {audioUrl && (
        <button
          type="button"
          onClick={() => void onPlaySingle(audioUrl)}
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
