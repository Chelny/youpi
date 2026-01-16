"use client";

import { ReactNode } from "react";
import clsx from "clsx/lite";

interface TimerProps {
  timer: number | null | undefined
}

export default function Timer({ timer }: TimerProps): ReactNode {
  const formatTime = (timeInSeconds: number | null | undefined): string => {
    if (timeInSeconds === null || typeof timeInSeconds === "undefined") return "--:--";

    const minutes: number = Math.floor(timeInSeconds / 60);
    const seconds: number = timeInSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={clsx(
        "w-full border-double border-8 border-neutral-300 font-mono text-gray-400 text-4xl text-center tabular-nums",
        "dark:border-slate-500 dark:text-slate-500",
      )}
    >
      {formatTime(timer)}
    </div>
  );
}
