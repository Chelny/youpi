"use client";

import { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { MIN_GAME_VIEWPORT_HEIGHT, MIN_GAME_VIEWPORT_WIDTH } from "@/constants/game";

export default function SmallScreenWarning(): ReactNode {
  const width: string = `${MIN_GAME_VIEWPORT_WIDTH}px`;
  const height: string = `${MIN_GAME_VIEWPORT_HEIGHT}px`;

  return (
    <div
      className={clsx(
        "small-screen-warning",
        "absolute inset-0 z-overlay flex flex-col justify-center items-center bg-white text-center",
        "dark:bg-dark-background",
      )}
    >
      <h1 className="text-2xl font-bold mb-2">
        <Trans>Screen Too Small</Trans>
      </h1>
      <p className="text-lg">
        <Trans>
          Resize the window (recommended size: {width} by {height})
          <br />
          or use a computer for a better experience.
        </Trans>
      </p>
    </div>
  );
}
