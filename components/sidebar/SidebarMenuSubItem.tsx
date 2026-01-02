"use client";

import { FocusEvent, KeyboardEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { GoTriangleDown, GoTriangleLeft } from "react-icons/go";
import { NotificationDropdownItem } from "@/components/sidebar/NotificationDropdownItem";
import { MenuItem, SidebarMenuActionItem, SidebarMenuLinkItem } from "@/interfaces/sidebar-menu";
import { NotificationPlainObject } from "@/server/towers/classes/Notification";
import { isLinkItem, isNotificationItem } from "@/utils/sidebar-menu";

type SidebarMenuSubItemProps = {
  item: MenuItem
  isActiveHref: (path: string) => boolean
  isLast: boolean
  level: number
};

export function SidebarMenuSubItem({ item, isActiveHref, isLast, level }: SidebarMenuSubItemProps): ReactNode {
  const { i18n, t } = useLingui();
  const [isDropdownVisible, setIsDropdownVisible] = useState<boolean>(false);
  const isExactActive: boolean = isLinkItem(item) && isActiveHref(item.href);
  const isChildActive: boolean =
    "children" in item &&
    !!item.children?.some(
      (child: SidebarMenuLinkItem | SidebarMenuActionItem | NotificationPlainObject) =>
        isLinkItem(child) && isActiveHref(child.href),
    );
  const isBranchActive: boolean = isExactActive || isChildActive;
  const isTreeActive: boolean =
    isBranchActive || (isNotificationItem(item) && (isDropdownVisible || item.unreadCount > 0));
  const [isOpen, setIsOpen] = useState<boolean>(!!isTreeActive);

  const activeTreeColor = (isActive: boolean) =>
    isActive ? "before:bg-youpi-primary after:bg-youpi-primary" : "before:bg-white/15 after:bg-white/15";

  const activeTreeFont = (isActive: boolean) =>
    isActive ? "text-white font-semibold" : "text-white/80 font-medium hover:font-semibold";

  // Link: Rooms and Tables
  if (isLinkItem(item)) {
    const hasChildren: boolean = !!item.children?.length;

    return (
      <li className="group/menu-sub-item">
        <div
          className={clsx(
            "relative flex items-center justify-between w-auto ps-6 ms-6.5",
            // Vertical line (rooms and tables)
            "before:content-[''] before:absolute before:block before:top-0 before:start-0 before:w-px",
            // T shape
            level > 0 &&
              "after:content-[''] after:block after:absolute after:top-1/2 after:start-0 after:-translate-y-1/2 after:w-4 after:h-px",
            // L shape
            level > 0 && isLast ? "before:h-5" : "before:h-full",
            activeTreeColor(isExactActive),
          )}
        >
          <Link
            href={item.href}
            className={clsx("flex-1 p-2 rounded-md", activeTreeFont(isExactActive))}
            aria-current={isExactActive ? "location" : undefined}
          >
            {item.label}
          </Link>

          {hasChildren && (
            <button
              type="button"
              className="p-2 rounded-md text-white/80"
              title={
                isOpen
                  ? i18n._("Collapse {label}", { label: item.label })
                  : i18n._("Expand {label}", { label: item.label })
              }
              aria-label={
                isOpen
                  ? i18n._("Collapse {label}", { label: item.label })
                  : i18n._("Expand {label}", { label: item.label })
              }
              aria-haspopup="true"
              aria-controls={`link-item-${item.id}-list`}
              aria-expanded={isOpen}
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <GoTriangleDown /> : <GoTriangleLeft className="rtl:-scale-x-100" />}
            </button>
          )}
        </div>

        {hasChildren && isOpen && (
          <ul id={`link-item-${item.id}-list`}>
            {item.children!.map(
              (
                child: SidebarMenuLinkItem | SidebarMenuActionItem,
                index: number,
                arr: (SidebarMenuLinkItem | SidebarMenuActionItem)[],
              ) => (
                <SidebarMenuSubItem
                  key={child.id}
                  item={child}
                  isActiveHref={isActiveHref}
                  isLast={index === arr.length - 1}
                  level={level + 1}
                />
              ),
            )}
          </ul>
        )}
      </li>
    );
  }

  // Notification: Table Invitations, Table Declines and Table Boots
  if (isNotificationItem(item)) {
    const unreadCount: number = item.unreadCount ?? 0;

    return (
      <li
        className={clsx(
          "relative ps-6 ms-6.5",
          // Vertical line (notifications)
          "before:content-[''] before:absolute before:block before:top-0 before:start-0 before:w-px",
          // T shape
          level > 0 &&
            "after:content-[''] after:block after:absolute after:top-1/2 after:start-0 after:-translate-y-1/2 after:w-4 after:h-px",
          // L shape
          level > 0 && isLast ? "before:h-5" : "before:h-full",
          activeTreeColor(isTreeActive),
        )}
      >
        <div
          id={`action-item-${item.id}-container`}
          className="relative"
          onBlur={(event: FocusEvent) => {
            const next: HTMLElement | null = event.relatedTarget as HTMLElement | null;
            if (!next?.closest?.(`#action-item-${item.id}-container`)) {
              setIsDropdownVisible(false);
            }
          }}
        >
          <button
            type="button"
            className={clsx("flex justify-between items-center w-full p-2 rounded-md", activeTreeFont(isTreeActive))}
            aria-haspopup="menu"
            aria-controls={`action-item-${item.id}-menu`}
            aria-expanded={isDropdownVisible}
            onClick={() => setIsDropdownVisible((prev: boolean) => !prev)}
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key === "Escape") {
                setIsDropdownVisible(false);
              }
            }}
          >
            <span className="flex items-center gap-2">
              {item.label}

              {unreadCount > 0 && (
                <span className="inline-flex justify-center min-w-[1.5rem] px-1.5 py-0.5 rounded-full bg-youpi-primary text-white text-xs font-semibold leading-none">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </span>
            <GoTriangleLeft className={clsx("-scale-x-100", "rtl:scale-x-100")} />
          </button>

          {isDropdownVisible && (
            <ul
              id={`action-item-${item.id}-menu`}
              className="overflow-y-auto absolute top-0 start-full z-dropdown w-[350px] max-h-96 p-2 divide-y divide-white/10 border border-gray-700 rounded-sm shadow-md bg-sidebar-background"
              aria-label={t({ message: "Notifications" })}
            >
              {item.children && item.children.length > 0 ? (
                item.children?.map((notification: NotificationPlainObject) => (
                  <NotificationDropdownItem key={notification.id} notification={notification} />
                ))
              ) : (
                <li role="presentation" className="px-3 py-1 text-white/60 text-center">
                  {t({ message: "No notifications" })}
                </li>
              )}
            </ul>
          )}
        </div>
      </li>
    );
  }

  return null;
}
