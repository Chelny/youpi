import { ReactNode } from "react";
import clsx from "clsx/lite";

export default function AvatarSelectionSkeleton(): ReactNode {
  return (
    <div className="grid lg:grid-cols-[350px_1fr] gap-4 animate-pulse">
      <div>
        <h3 className="text-lg font-semibold">
          <div className={clsx("h-6 mb-2 rounded-md bg-gray-200 w-1/3", "dark:bg-dark-skeleton-content-background")} />
        </h3>
        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
          <p className={clsx("h-4 rounded-md bg-gray-200 w-2/3", "dark:bg-dark-skeleton-content-background")} />
        </div>
      </div>

      <div className="grid w-full">
        <div
          className={clsx(
            "grid gap-1 py-1.5 border border-gray-400 rounded bg-gray-100",
            "dark:border-slate-500 dark:bg-slate-700",
          )}
        >
          <div className="grid grid-cols-5 gap-1 px-1">
            {Array.from({ length: 20 }).map((_, index: number) => (
              <div key={index} className="flex justify-center gap-2 px-4 py-1 rounded">
                <div className={clsx("w-8 h-8 rounded-full bg-gray-300", "dark:bg-dark-skeleton-content-background")} />
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 max-md:w-full md:place-self-end">
          <div className={clsx("min-w-40 h-10 rounded-xs bg-gray-200", "dark:bg-dark-skeleton-content-background")} />
        </div>
      </div>
    </div>
  );
}
