import { ReactNode } from "react";
import clsx from "clsx/lite";

export default function ThemeFormSkeleton(): ReactNode {
  return (
    <div className="grid lg:grid-cols-[350px_1fr] gap-4 animate-pulse">
      {/* Title section */}
      <div>
        <h2 className="text-lg font-semibold">
          <div className={clsx("h-6 mb-2 rounded-md bg-gray-200 w-1/3", "dark:bg-dark-skeleton-content-background")} />
        </h2>
        <div className={clsx("text-gray-500", "dark:text-dark-text-muted")}>
          <p className={clsx("h-4 rounded-md bg-gray-200 w-2/3", "dark:bg-dark-skeleton-content-background")} />
        </div>
      </div>

      {/* Form skeleton */}
      <div className="grid w-full">
        {/* Select field */}
        <div className="relative w-full mb-4">
          <label className="mb-1 font-medium">
            <div className={clsx("w-30 h-4 mb-1 rounded-md bg-gray-200", "dark:bg-dark-skeleton-content-background")} />
          </label>

          {/* Select box with icon and text */}
          <div
            className={clsx(
              "flex justify-between items-center",
              "w-full h-12 px-3 py-2",
              "border-2 border-gray-200 rounded-xs",
              "bg-gray-200",
              "dark:border-dark-skeleton-border",
              "dark:bg-dark-skeleton-content-background",
            )}
          >
            <div className="flex items-center gap-2">
              {/* Icon skeleton */}
              <div className={clsx("w-5 h-5 rounded-full bg-gray-300", "dark:bg-dark-skeleton-border")} />
              {/* Theme name skeleton */}
              <div className={clsx("h-3 rounded-md bg-gray-300 w-32", "dark:bg-dark-skeleton-border")} />
            </div>
            {/* Dropdown arrow */}
            <div className={clsx("w-5 h-5 rounded-sm bg-gray-300", "dark:bg-dark-skeleton-border")} />
          </div>
        </div>

        {/* Submit button */}
        <div className="max-md:w-full md:place-self-end">
          <div className={clsx("min-w-40 h-10 rounded-xs bg-gray-200", "dark:bg-dark-skeleton-content-background")} />
        </div>
      </div>
    </div>
  );
}
