// 学習フロー（取得・再生・リピート・次へ）を統括するフック
"use client";

import { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseStudyItemRepository } from "@/lib/repository/studyItemRepository";
import type { StudyItem } from "@/lib/repository/types";
import { useSequentialAudio } from "@/lib/audio/useSequentialAudio";

type Phase = "idle" | "loading" | "ready" | "playing";

interface UseStudySessionResult {
  currentItem: StudyItem | null;
  phase: Phase;
  errorMessage: string | null;
  start(): Promise<void>;
  repeat(): Promise<void>;
  next(): Promise<void>;
}

export function useStudySession(): UseStudySessionResult {
  const [currentItem, setCurrentItem] = useState<StudyItem | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const repositoryRef = useRef<SupabaseStudyItemRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new SupabaseStudyItemRepository(createClient());
  }

  const { play } = useSequentialAudio();

  const playItem = useCallback(
    async (item: StudyItem) => {
      setPhase("playing");
      try {
        const urls = [item.jaAudioUrl, item.enAudioUrl, item.koAudioUrl].filter(
          (url): url is string => url !== null
        );
        await play(urls);
        setPhase("ready");
      } catch {
        setErrorMessage("音声の再生に失敗しました。");
        setPhase("ready");
      }
    },
    [play]
  );

  const fetchAndSet = useCallback(async (): Promise<StudyItem | null> => {
    setPhase("loading");
    setErrorMessage(null);
    try {
      const item = await repositoryRef.current!.fetchNext();
      if (!item) {
        setErrorMessage("学習データが見つかりませんでした。");
        setPhase("idle");
        return null;
      }
      setCurrentItem(item);
      return item;
    } catch {
      setErrorMessage("データの取得に失敗しました。");
      setPhase("idle");
      return null;
    }
  }, []);

  const start = useCallback(async () => {
    const item = await fetchAndSet();
    if (item) {
      await playItem(item);
    }
  }, [fetchAndSet, playItem]);

  const repeat = useCallback(async () => {
    if (!currentItem) return;
    await playItem(currentItem);
  }, [currentItem, playItem]);

  const next = useCallback(async () => {
    const item = await fetchAndSet();
    if (item) {
      await playItem(item);
    }
  }, [fetchAndSet, playItem]);

  return { currentItem, phase, errorMessage, start, repeat, next };
}
