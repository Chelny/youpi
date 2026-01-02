"use client";

import { ReactNode } from "react";

export default function TestModeBanner(): ReactNode {
  const text: string = "⚠️ Test mode activated ⚠️";

  if (process.env.TEST_MODE !== "true") return null;

  return (
    <div
      className="fixed top-0 left-0 z-dev w-full bg-red-500 text-white font-medium overflow-hidden select-none cursor-default"
      role="status"
      tabIndex={0}
      aria-live="polite"
    >
      <div className="animate-marquee hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]">
        <span className="whitespace-nowrap">{text}</span>
      </div>
    </div>
  );
}
