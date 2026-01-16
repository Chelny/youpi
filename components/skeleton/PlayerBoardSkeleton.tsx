import { ReactNode } from "react";
import clsx from "clsx/lite";

type PlayerBoardSkeletonProps = {
  isOpponentBoard: boolean
  isReversed: boolean
  dir: string
};

export default function PlayerBoardSkeleton({
  isOpponentBoard = false,
  isReversed = false,
  dir = "ltr",
}: PlayerBoardSkeletonProps): ReactNode {
  return (
    <div className={clsx("flex flex-col animate-pulse", isOpponentBoard && "w-player-board-opponent-width")}>
      {/* User avatar + username */}
      <div
        className={clsx(
          "grid gap-1",
          !isOpponentBoard ? "h-6" : "h-4",
          !isOpponentBoard &&
            isReversed &&
            "grid-cols-[1fr_max-content] ps-0 pe-2 rtl:grid-cols-[max-content_1fr] rtl:ps-2 rtl:pe-0",
          !isOpponentBoard &&
            !isReversed &&
            "grid-cols-[max-content_1fr] ps-2 pe-0 rtl:grid-cols-[1fr_max-content] rtl:ps-0 rtl:pe-2",
          isOpponentBoard && isReversed && "grid-cols-1 ps-0 pe-1.5 rtl:grid-cols-1 rtl:ps-1.5 rtl:pe-0",
          isOpponentBoard && !isReversed && "grid-cols-1 ps-1.5 pe-0 rtl:grid-cols-1 rtl:ps-0 rtl:pe-1.5",
        )}
        dir={dir}
      >
        <div
          className={clsx(
            "w-player-board-username-empty-space-width",
            isOpponentBoard && "hidden",
            isReversed ? "order-2 rtl:order-1" : "order-1 rtl:order-2",
            "before:content-[' ']",
          )}
        />
        <div
          className={clsx(
            "flex items-center truncate",
            isOpponentBoard ? "gap-1 w-player-board-username-opponent-width" : "gap-2 w-player-board-username-width",
            isReversed ? "order-1 ms-1 me-0.5 rtl:order-2" : "order-2 ms-0.5 me-1 rtl:order-1",
          )}
        >
          <>
            <div
              className={clsx(
                "shrink-0 rounded-full bg-gray-200 dark:bg-dark-skeleton-content-background",
                isOpponentBoard ? "w-4 h-4" : "w-6 h-6",
              )}
            />
            <div
              className={clsx(
                "rounded bg-gray-200 dark:bg-dark-skeleton-content-background",
                isOpponentBoard ? "w-full h-4" : "w-full h-6",
              )}
            />
          </>
        </div>
      </div>

      {/* Main board */}
      <div
        className={clsx(
          "grid gap-2 w-full mt-2 border-y-8 border-gray-300 bg-gray-200",
          isOpponentBoard
            ? "[grid-template-areas:'board-grid-container''board-grid-container']"
            : isReversed
              ? "[grid-template-areas:'board-grid-container_preview-piece''board-grid-container_power-bar']"
              : "[grid-template-areas:'preview-piece_board-grid-container''power-bar_board-grid-container']",
          isOpponentBoard ? "" : "grid-rows-[max-content_auto] grid-cols-[max-content_auto]",
          isReversed
            ? "border-s-2 border-s-gray-300 border-e-8 border-e-gray-300"
            : "border-s-8 border-s-gray-300 border-e-2 border-e-gray-300",
          "dark:border-dark-skeleton-border dark:bg-dark-skeleton-content-background",
        )}
      >
        <div
          className={clsx(
            "[grid-area:board-grid-container] relative grid w-full rounded-sm bg-gray-200",
            isOpponentBoard
              ? "grid-rows-(--grid-rows-grid-container-opponent) w-grid-container-opponent-width"
              : "grid-rows-(--grid-rows-grid-container) w-grid-container-width",
            "before:content-[attr(data-seat-number)] before:absolute before:start-1/2 before:-translate-x-1/2 before:text-[7rem] before:font-bold before:text-center",
            "dark:bg-dark-skeleton-content-background",
          )}
        />

        {/* Next piece and power bar */}
        {!isOpponentBoard && (
          <>
            <div
              className={clsx(
                "[grid-area:preview-piece] flex flex-col items-center justify-center h-preview-piece-height px-2 py-2 rounded-sm bg-gray-200",
                isOpponentBoard ? "" : "w-preview-piece-width",
                "dark:bg-dark-skeleton-content-background",
              )}
            />
            <div
              className={clsx(
                "[grid-area:power-bar] flex flex-col items-center justify-end h-power-bar-height px-2 py-2 rounded-sm bg-gray-200",
                isOpponentBoard ? "" : "w-power-bar-width",
                "dark:bg-dark-skeleton-content-background",
              )}
            />
          </>
        )}
      </div>
    </div>
  );
}
