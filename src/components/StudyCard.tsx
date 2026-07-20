// IPA表示と操作ボタンを持つ学習カード（答えとなるテキストは表示しない）
"use client";

import { useStudySession } from "@/lib/hooks/useStudySession";

export function StudyCard() {
  const { currentItem, phase, errorMessage, start, repeat, next } =
    useStudySession();

  const isBusy = phase === "loading" || phase === "playing";
  const hasStarted = currentItem !== null;

  return (
    <div className="flex min-h-[70vh] w-full flex-col items-center justify-center gap-8 px-4 text-center">
      <div className="flex min-h-[8rem] w-full items-center justify-center">
        {currentItem ? (
          <p className="break-words text-5xl font-bold tracking-wide sm:text-6xl md:text-7xl">
            {currentItem.ipa}
          </p>
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

      {phase === "loading" && (
        <p className="text-sm text-gray-500">読み込み中...</p>
      )}
      {phase === "playing" && (
        <p className="text-sm text-gray-500">再生中...</p>
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
