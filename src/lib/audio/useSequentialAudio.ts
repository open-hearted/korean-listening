// 複数の音声URLを順番に連続再生するカスタムフック
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseSequentialAudioResult {
  play(urls: string[]): Promise<void>;
  stop(): void;
  isPlaying: boolean;
}

export function useSequentialAudio(): UseSequentialAudioResult {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRequestedRef = useRef(false);

  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const play = useCallback(async (urls: string[]) => {
    // 前の再生が進行中なら停止してから開始する
    stopRequestedRef.current = true;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    stopRequestedRef.current = false;
    setIsPlaying(true);

    try {
      for (const url of urls) {
        if (stopRequestedRef.current) {
          break;
        }

        const audio = new Audio(url);
        audioRef.current = audio;

        await new Promise<void>((resolve, reject) => {
          const handleEnded = () => {
            cleanup();
            resolve();
          };
          const handleError = () => {
            cleanup();
            reject(new Error(`音声の再生に失敗しました: ${url}`));
          };
          const cleanup = () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
          };

          audio.addEventListener("ended", handleEnded);
          audio.addEventListener("error", handleError);

          audio.play().catch((err) => {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
        });
      }
    } finally {
      audioRef.current = null;
      setIsPlaying(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      stopRequestedRef.current = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  return { play, stop, isPlaying };
}
