"use client";

import { PropsWithChildren, ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReadonlyURLSearchParams, usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx/lite";
import { GoTriangleDown, GoTriangleLeft } from "react-icons/go";
import { IconType } from "react-icons/lib";
import { SidebarMenuSubItem } from "@/components/sidebar/SidebarMenuSubItem";
import { MenuItem } from "@/interfaces/sidebar-menu";
import { Language, languages } from "@/translations/languages";
import { isLinkItem } from "@/utils/sidebar-menu";

type SidebarMenuItemProps = PropsWithChildren<{
  id: string
  Icon: IconType
  ariaLabel: string
  isExpanded?: boolean
  href?: string
  menuItems?: MenuItem[]
  isBadgeVisible?: boolean
  disabled?: boolean
  onClick?: () => void
}>;

export default function SidebarMenuItem({
  children,
  id,
  Icon,
  ariaLabel,
  isExpanded = false,
  href = undefined,
  menuItems = [],
  isBadgeVisible = false,
  disabled = false,
  onClick,
}: SidebarMenuItemProps): ReactNode {
  const pathname: string = usePathname();
  const searchParams: ReadonlyURLSearchParams = useSearchParams();
  const [isMounted, setIsMounted] = useState<boolean>(false);

  const isActiveHref = useMemo(() => {
    const cleanPath: string = stripLocaleFromPath(pathname);
    const current: string = currentSignature(cleanPath, searchParams);

    return (href: string): boolean => {
      const candidate: string = routeSignature(stripLocaleFromPath(href));
      return candidate === current;
    };
  }, [pathname, searchParams]);

  const isLinkActive = useMemo(() => (href ? isActiveHref(href) : false), [href, isActiveHref]);
  const ariaCurrent: "location" | "page" | undefined = isLinkActive
    ? menuItems.length
      ? "location"
      : "page"
    : undefined;

  const isDescendantActive = useMemo(() => {
    if (!menuItems.length) return false;
    return menuItems.some((mi: MenuItem) => isMenuTreeActive(mi, isActiveHref));
  }, [menuItems, isActiveHref]);

  const [isAccordionOpen, setAccordionOpen] = useState<boolean>(() => isDescendantActive);

  const baseItemClassName: string = clsx(
    "group/menu-item flex items-center gap-3 w-full p-2 text-white/80",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "hover:font-semibold",
  );

  const iconBoxClassName = (isActive: boolean) =>
    clsx(
      "relative p-2 border-2 rounded-md",
      "group-hover/menu-item:border-white/30 group-focus-visible/menu-item:border-white/30",
      isActive
        ? "border-youpi-primary/80 bg-youpi-primary/50 text-white/90"
        : "border-slate-600 bg-slate-700 text-white/70",
    );

  const labelClassName: string = clsx(
    "transition-opacity duration-300",
    isExpanded ? "block opacity-100" : "hidden opacity-0",
  );

  const accordionLabelClassName: string = clsx(
    "flex justify-between items-center w-full transition-opacity duration-300",
    isExpanded ? "block opacity-100" : "hidden opacity-0",
  );

  const iconIsActive: boolean = href ? isLinkActive : isDescendantActive;

  const handleClickMenuItem = (): void => {
    if (menuItems.length > 0) {
      if (!isExpanded) {
        onClick?.();
      } else {
        setAccordionOpen((prev: boolean) => !prev);
      }
    } else {
      onClick?.();
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    setAccordionOpen(isDescendantActive);
  }, [isDescendantActive]);

  return (
    <div
      className={clsx(
        "rounded-md overflow-visible",
        isExpanded ? "w-full" : "w-auto",
        isExpanded && isLinkActive ? "font-bold" : "font-medium",
      )}
    >
      {href ? (
        <Link
          className={baseItemClassName}
          href={href}
          title={ariaLabel}
          aria-label={ariaLabel}
          aria-current={ariaCurrent}
        >
          <div className={iconBoxClassName(iconIsActive)}>
            <Icon className="w-4 h-4 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
          </div>
          <div className={labelClassName}>{children}</div>
        </Link>
      ) : (
        <button
          type="button"
          className={baseItemClassName}
          title={ariaLabel}
          disabled={isMounted ? disabled : false}
          aria-label={ariaLabel}
          aria-expanded={menuItems.length > 0 ? isAccordionOpen : undefined}
          aria-controls={menuItems.length > 0 ? `menu-item-${id}-list` : undefined}
          onClick={handleClickMenuItem}
        >
          <div className={iconBoxClassName(iconIsActive)}>
            <Icon className="w-4 h-4 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
            {isBadgeVisible && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-red-500" />}
          </div>
          <div className={accordionLabelClassName}>
            {menuItems.length > 0 ? (
              <>
                <span>{children}</span>
                {isAccordionOpen ? <GoTriangleDown /> : <GoTriangleLeft className="rtl:-scale-x-100" />}
              </>
            ) : (
              children
            )}
          </div>
        </button>
      )}

      {menuItems.length > 0 && isExpanded && (
        <ul
          id={`menu-item-${id}-list`}
          className={clsx(
            "flex flex-col transition-[max-height] duration-200",
            isAccordionOpen ? "overflow-visible max-h-screen my-2" : "overflow-hidden max-h-0",
          )}
          hidden={!isAccordionOpen}
        >
          {menuItems.map((menuItem: MenuItem, index: number, arr: MenuItem[]) => (
            <SidebarMenuSubItem
              key={menuItem.id}
              item={menuItem}
              isActiveHref={isActiveHref}
              isLast={index === arr.length - 1}
              level={0}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function routeSignature(href: string): string {
  const url: URL = new URL(href, process.env.BASE_URL);
  return `${url.pathname}?${[...url.searchParams.entries()]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("&")}`;
}

function currentSignature(pathname: string, searchParams: URLSearchParams) {
  return `${pathname}?${[...searchParams.entries()]
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join("&")}`;
}

function stripLocaleFromPath(path: string): string {
  const segments: string[] = path.split("/").filter(Boolean);
  const locales: string[] = languages.map((language: Language) => language.locale);

  if (locales.includes(segments[0])) {
    segments.shift();
  }

  return "/" + segments.join("/");
}

function isMenuTreeActive(item: MenuItem, isActiveHref: (href: string) => boolean): boolean {
  if (isLinkItem(item) && isActiveHref(item.href)) return true;

  if ("children" in item && item.children?.length) {
    return item.children.some((child: MenuItem) => isMenuTreeActive(child, isActiveHref));
  }

  return false;
}
