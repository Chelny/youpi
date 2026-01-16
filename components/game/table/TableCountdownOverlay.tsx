import { ReactNode } from "react";
import { Plural, Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { GameState } from "db/enums";

type TableCountdownOverlayProps = {
  gameState: GameState
  countdown: number | null
};

export function TableCountdownOverlay({ gameState, countdown }: TableCountdownOverlayProps): ReactNode {
  return (
    <>
      {gameState === GameState.COUNTDOWN && countdown !== null && (
        <div
          className={clsx(
            "absolute start-1/2 -translate-x-1/2 bottom-[8px] z-game-overlay flex flex-col items-center w-[450px] h-48 p-1 border-2 border-gray-400 bg-gray-200 shadow-lg",
            "dark:bg-slate-700",
            "rtl:translate-x-1/2",
          )}
        >
          <Trans>
            <div className="text-2xl">The next game is starting in</div>
            <div className="flex-1 flex items-center text-7xl text-orange-400 font-semibold normal-nums">
              {countdown}
            </div>
            <div className="text-2xl">
              <Plural value={countdown} one="second" other="seconds" />
            </div>
          </Trans>
        </div>
      )}
    </>
  );
}
