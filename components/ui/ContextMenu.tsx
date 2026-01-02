import { MouseEvent, ReactNode } from "react";
import clsx from "clsx/lite";
import Portal from "@/components/Portal";

export type ContextMenuState<T> = { x: number; y: number; data: T } | null;

export type ContextMenuItem<T> = {
  label: string | ((item: T) => string)
  disabled?: boolean
  onClick: (data: T) => void
};

export type ContextMenuSection<T> = {
  items: ContextMenuItem<T>[]
};

export type ContextMenuProps<T> = {
  menu: ContextMenuState<T>
  sections: ContextMenuSection<T>[]
  onCloseMenu: () => void
};

export function ContextMenu<T>({
  menu,
  onCloseMenu,
  sections,
  container,
}: ContextMenuProps<T> & { container?: HTMLElement | null }): ReactNode {
  if (!menu) return null;

  return (
    <Portal container={container}>
      <div
        className={clsx("fixed z-toast py-1 border border-slate-700 rounded shadow-lg bg-white", "dark:bg-slate-800")}
        style={{ top: menu.y, left: menu.x, minWidth: "180px" }}
        onContextMenu={(event: MouseEvent) => event.preventDefault()}
      >
        <ul className="p-0 m-0 list-none">
          {sections.map((section: ContextMenuSection<T>, index: number) => (
            <li key={index}>
              <ul className="p-0 m-0">
                {section.items.map((item: ContextMenuItem<T>, idx: number) => {
                  const label: string = typeof item.label === "function" ? item.label(menu.data) : item.label;
                  return (
                    <li
                      key={idx}
                      className={clsx(
                        "px-3 py-2 hover:cursor-pointer hover:bg-slate-200",
                        "dark:hover:bg-slate-700",
                        item.disabled && "opacity-50 cursor-not-allowed",
                      )}
                      onClick={() => {
                        if (!item.disabled) {
                          item.onClick(menu.data);
                          onCloseMenu();
                        }
                      }}
                    >
                      {label}
                    </li>
                  );
                })}
              </ul>

              {index < sections.length - 1 && <hr className="my-1 border-t border-slate-300 dark:border-slate-700" />}
            </li>
          ))}
        </ul>
      </div>
    </Portal>
  );
}
