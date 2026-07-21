// 本日聞いた例文数をアクティビティリング風に常時表示する（学習の邪魔にならない位置に置く想定）
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseDailyProgressRepository } from "@/lib/repository/dailyProgressRepository";
import { subscribePlayLogRecorded } from "@/lib/events/playLogEvents";

const GOAL = 10;
const SIZE = 44;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CENTER = SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function DailyStudyRing() {
  const [count, setCount] = useState(0);
  const [isHidden, setIsHidden] = useState(false);

  const repositoryRef = useRef<SupabaseDailyProgressRepository | null>(null);
  if (!repositoryRef.current) {
    repositoryRef.current = new SupabaseDailyProgressRepository(createClient());
  }

  const load = useCallback(async () => {
    try {
      const value = await repositoryRef.current!.fetchTodayStudiedCount();
      setCount(value);
      setIsHidden(false);
    } catch {
      setIsHidden(true);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribePlayLogRecorded(() => void load());
  }, [load]);

  if (isHidden) {
    return null;
  }

  const achieved = count >= GOAL;
  const progress = Math.min(count / GOAL, 1);
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`本日の学習数 ${count} / ${GOAL}`}
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          className="text-gray-200"
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          className={achieved ? "text-green-500" : "text-blue-600"}
        />
        <text
          x={CENTER}
          y={CENTER}
          textAnchor="middle"
          dominantBaseline="central"
          className={`fill-current text-[9px] font-semibold ${
            achieved ? "text-green-600" : "text-gray-700"
          }`}
        >
          {count}/{GOAL}
        </text>
      </svg>
    </div>
  );
}
