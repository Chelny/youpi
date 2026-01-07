"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Value, ValueError } from "@sinclair/typebox/value";
import { WebsiteTheme } from "db/enums";
import { useTheme } from "next-themes";
import { IconType } from "react-icons/lib";
import { TbBrightnessFilled, TbMoon, TbSunHigh } from "react-icons/tb";
import {
  ThemeFormValidationErrors,
  ThemePayload,
  themeSchema,
} from "@/app/[locale]/(protected)/account/settings/theme.schema";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Session } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

type ThemeFormProps = {
  session: Session | null
};

export function ThemeForm({ session }: ThemeFormProps): ReactNode {
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { i18n, t } = useLingui();
  const { settingsResponse, isLoading, updateSettings } = useUserSettings(session?.user.id);
  const currentTheme: WebsiteTheme =
    settingsResponse?.data?.theme ?? session?.user.userSettings?.theme ?? WebsiteTheme.SYSTEM;
  const [themeValue, setThemeValue] = useState<WebsiteTheme>(currentTheme);
  const { setTheme } = useTheme();

  const labelMap: Record<WebsiteTheme, { icon: IconType; label: string }> = {
    [WebsiteTheme.LIGHT]: {
      icon: TbSunHigh,
      label: t({ message: "Light" }),
    },
    [WebsiteTheme.DARK]: {
      icon: TbMoon,
      label: t({ message: "Dark" }),
    },
    [WebsiteTheme.SYSTEM]: {
      icon: TbBrightnessFilled,
      label: t({ message: "System" }),
    },
  };

  useEffect(() => {
    setThemeValue(currentTheme);
  }, [currentTheme]);

  const handleUpdateTheme = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: ThemePayload = {
      theme: formData.get("theme") as WebsiteTheme,
    };

    const errors: ValueError[] = Array.from(Value.Errors(themeSchema, payload));
    const errorMessages: ThemeFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "theme":
          errorMessages.theme = t({ message: "The theme is invalid." });
          break;
        default:
          logger.warn(`Theme Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (Object.keys(errorMessages).length > 0) {
      setFormState({
        success: false,
        message: t({ message: "Validation errors occurred." }),
        error: errorMessages,
      });
    } else {
      try {
        await updateSettings({ theme: payload.theme });
        setTheme(payload.theme.toLowerCase());
        setFormState({ success: true, message: t({ message: "The theme has been updated!" }) });
      } catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setFormState({ success: false, message: (error as any).message });
      }
    }
  };

  return (
    <AccountSectionHeader
      title={<Trans>Theme</Trans>}
      description={<Trans>Choose how the site looks and feels.</Trans>}
    >
      <form className="grid w-full" noValidate onSubmit={handleUpdateTheme}>
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <Select
          id="theme"
          label={t({ message: "Theme" })}
          defaultValue={themeValue}
          required
          disabled={isLoading}
          dataTestId="settings_select_theme"
          onChange={(value: string) => setThemeValue(value as WebsiteTheme)}
        >
          {Object.values(WebsiteTheme).map((theme: WebsiteTheme) => {
            const Icon = labelMap[theme].icon;

            return (
              <Select.Option key={theme} value={theme}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
                  <div>{i18n._(labelMap[theme].label)}</div>
                </div>
              </Select.Option>
            );
          })}
        </Select>
        <Button type="submit" className="max-md:w-full md:place-self-end" disabled={isLoading}>
          <Trans>Update Theme</Trans>
        </Button>
      </form>
    </AccountSectionHeader>
  );
}
