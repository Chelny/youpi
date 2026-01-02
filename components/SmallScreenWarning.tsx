"use client";

import { ReactNode } from "react";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";

export default function SmallScreenWarning(): ReactNode {
  const width: string = "1275px";
  const height: string = "768px";

  return (
    <div
      className={clsx(
        "small-screen-warning",
        "absolute inset-0 z-sticky flex flex-col justify-center items-center bg-white text-center",
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
