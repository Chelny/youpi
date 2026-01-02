import { ReactNode } from "react";
import clsx from "clsx/lite";

export default function RoomsListSkeleton(): ReactNode {
  const sections: number[] = Array.from({ length: 4 });
  const cardsPerSection: number = 4;

  return (
    <div className="flex flex-col gap-10 animate-pulse">
      {sections.map((_, sectionIndex: number) => (
        <section key={sectionIndex} className="flex flex-col gap-4 mb-4">
          <div className="flex items-center">
            <div className="flex items-center gap-2">
              <div className={clsx("h-6 w-50 rounded-sm bg-gray-200", "dark:bg-dark-skeleton-content-background")} />
            </div>
          </div>

          <ul className="grid grid-cols-[repeat(auto-fill,_minmax(14rem,_1fr))] gap-8">
            {Array.from({ length: cardsPerSection }).map((_, index: number) => (
              <li
                key={index}
                className={clsx(
                  "flex flex-col gap-2 p-4 border border-gray-300 rounded-sm bg-white",
                  "dark:border-dark-card-border dark:bg-dark-card-background",
                )}
              >
                <div className={clsx("h-5 w-3/4 rounded-sm bg-gray-200", "dark:bg-dark-skeleton-content-background")} />

                <div className={clsx("h-4 w-1/3 rounded-sm bg-gray-200", "dark:bg-dark-skeleton-content-background")} />

                <div>
                  <div
                    className={clsx("h-10 w-full rounded-sm bg-gray-200", "dark:bg-dark-skeleton-content-background")}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
