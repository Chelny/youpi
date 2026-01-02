"use client";

import { ReactNode, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { WebsiteTheme } from "db/enums";
import { useTheme } from "next-themes";
import { IconType } from "react-icons/lib";
import { TbBrightnessFilled, TbMoon, TbSunHigh } from "react-icons/tb";
import { useSocket } from "@/context/SocketContext";
import { useUserSettings } from "@/hooks/useUserSettings";

export default function ThemeToggleButton(): ReactNode {
  const { setTheme } = useTheme();
  const { t } = useLingui();
  const { session } = useSocket();
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const { settingsResponse, isLoading, updateSettings } = useUserSettings(session?.user.id);
  const websiteTheme: WebsiteTheme = settingsResponse?.data?.theme ?? WebsiteTheme.SYSTEM;

  const labelMap: Record<WebsiteTheme, string> = {
    [WebsiteTheme.LIGHT]: t({ message: "Light" }),
    [WebsiteTheme.DARK]: t({ message: "Dark" }),
    [WebsiteTheme.SYSTEM]: t({ message: "System" }),
  };

  const themeLabel: string = labelMap[websiteTheme];

  const Icon: IconType =
    websiteTheme === WebsiteTheme.LIGHT ? TbSunHigh : websiteTheme === WebsiteTheme.DARK ? TbMoon : TbBrightnessFilled;

  const handleSetTheme = async (): Promise<void> => {
    const nextTheme: WebsiteTheme =
      websiteTheme === WebsiteTheme.LIGHT
        ? WebsiteTheme.DARK
        : websiteTheme === WebsiteTheme.DARK
          ? WebsiteTheme.SYSTEM
          : WebsiteTheme.LIGHT;

    try {
      await updateSettings({ theme: nextTheme });
      setTheme(nextTheme.toLowerCase());
    } catch {
      const fallback: WebsiteTheme = settingsResponse?.data?.theme ?? WebsiteTheme.SYSTEM;
      setTheme(fallback.toLowerCase());
    }
  };

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    setTheme(websiteTheme.toLowerCase());
  }, [websiteTheme]);

  if (!isMounted) return null;

  return (
    <button
      type="button"
      className={clsx(
        "flex items-center gap-3 w-full p-2 rounded-md",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        isLoading && "hidden",
      )}
      title={t({ message: "Theme" })}
      aria-label={t({ message: "Theme" })}
      data-testid="website-theme"
      onClick={handleSetTheme}
    >
      <Icon className="w-6 h-6 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
      <Trans>Theme: {themeLabel}</Trans>
    </button>
  );
}
