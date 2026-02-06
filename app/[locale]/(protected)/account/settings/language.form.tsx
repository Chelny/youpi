"use client";

import { FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useLingui as LinguiServer } from "@lingui/react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Value, ValueError } from "@sinclair/typebox/value";
import {
  LanguageFormValidationErrors,
  LanguagePayload,
  languageSchema,
} from "@/app/[locale]/(protected)/account/settings/language.schema";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import AlertMessage from "@/components/ui/AlertMessage";
import Select from "@/components/ui/Select";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { APP_STORAGE_KEYS } from "@/constants/app";
import { Session } from "@/lib/auth-client";
import { logger } from "@/lib/logger";
import { DEFAULT_LOCALE, Language, languages, SupportedLocales } from "@/translations/languages";

type LanguageFormProps = {
  session: Session | null
};

export function LanguageForm({ session }: LanguageFormProps): ReactNode {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();
  const { i18n } = LinguiServer();
  const pathname: string = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const [language, setLanguage] = useState<string>(session?.user.language ?? DEFAULT_LOCALE);

  useEffect(() => {
    const savedState: string | null = localStorage.getItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE);

    if (savedState) {
      setFormState(JSON.parse(savedState));
      localStorage.removeItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE);
    }
  }, []);

  useEffect(() => {
    if (language !== session?.user.language) {
      formRef.current?.requestSubmit();
    }
  }, [language]);

  const handleUpdateLanguage = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: LanguagePayload = {
      language: formData.get("language") as SupportedLocales,
    };

    const errors: ValueError[] = Array.from(Value.Errors(languageSchema, payload));
    const errorMessages: LanguageFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "language":
          errorMessages.language = t({ message: "The language is invalid." });
          break;
        default:
          logger.warn(`Language Validation: Unknown error at ${error.path}`);
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
      setIsLoading(true);

      await fetch(`/api/users/${session?.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          language: payload.language,
        }),
      })
        .then(async (response: Response) => {
          const data: ApiResponse = await response.json();
          setIsLoading(false);

          if (payload.language !== session?.user.language) {
            // Show form success message after page reload from language change
            localStorage.setItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE, JSON.stringify(data));

            // Dynamically change language
            const pathNameWithoutLocale: string[] = pathname?.split("/")?.slice(2) ?? [];
            const newPath: string = `/${payload.language}/${pathNameWithoutLocale.join("/")}`;
            window.location.href = newPath;
          }
        })
        .catch(async (error) => {
          const data: ApiResponse = await error.json();
          setIsLoading(false);
          localStorage.setItem(APP_STORAGE_KEYS.SETTINGS_FORM_STATE, JSON.stringify(data));
        });
    }
  };

  return (
    <AccountSectionHeader
      title={<Trans>Language</Trans>}
      description={<Trans>Choose the language used across the site.</Trans>}
    >
      <form
        ref={formRef}
        className="grid w-full"
        noValidate
        data-testid="settings_form_language"
        onSubmit={handleUpdateLanguage}
      >
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <Select
          id="language"
          label={t({ message: "Language" })}
          defaultValue={session?.user.language ?? DEFAULT_LOCALE}
          required
          disabled={isLoading}
          dataTestId="settings_select_language"
          onChange={(value: string) => {
            if (!value) return;
            setLanguage(value);
          }}
        >
          {languages.map((language: Language) => (
            <Select.Option key={language.locale} value={language.locale}>
              <div className="flex gap-2">
                <div>{language.flag}</div>
                <div>{i18n._(language.getLabel())}</div>
              </div>
            </Select.Option>
          ))}
        </Select>
      </form>
    </AccountSectionHeader>
  );
}
