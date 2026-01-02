import { ReactNode, Suspense } from "react";
import { Metadata } from "next";
import { headers } from "next/headers";
import { I18n } from "@lingui/core";
import clsx from "clsx/lite";
import { LanguageForm } from "@/app/[locale]/(protected)/account/settings/language.form";
import { ThemeForm } from "@/app/[locale]/(protected)/account/settings/theme.form";
import { initLingui } from "@/app/init-lingui";
import LanguageFormSkeleton from "@/components/skeleton/LanguageFormSkeleton";
import ThemeFormSkeleton from "@/components/skeleton/ThemeFormSkeleton";
import { ROUTE_SETTINGS } from "@/constants/routes";
import { auth } from "@/lib/auth";
import { Session } from "@/lib/auth-client";

type SettingsProps = PageProps<"/[locale]/account/settings">;

export async function generateMetadata({ params }: SettingsProps): Promise<Metadata> {
  const { locale } = await params;
  const i18n: I18n = initLingui(locale);

  return {
    title: i18n._(ROUTE_SETTINGS.TITLE),
  };
}

export default async function Settings({ params }: SettingsProps): Promise<ReactNode> {
  const { locale } = await params;
  const i18n: I18n = initLingui(locale);
  const session: Session | null = await auth.api.getSession({ headers: await headers() });

  return (
    <>
      <h1 className="mb-4 text-3xl">{i18n._(ROUTE_SETTINGS.TITLE)}</h1>
      <div className="flex flex-col gap-6">
        {/* Language */}
        <section
          className={clsx(
            "p-4 border border-gray-200 rounded-lg shadow-xs bg-gray-50",
            "dark:border-dark-card-border dark:bg-dark-card-background",
          )}
        >
          <Suspense fallback={<LanguageFormSkeleton />}>
            <LanguageForm session={session} />
          </Suspense>
        </section>

        {/* Theme */}
        <section
          className={clsx(
            "p-4 border border-gray-200 rounded-lg shadow-xs bg-gray-50",
            "dark:border-dark-card-border dark:bg-dark-card-background",
          )}
        >
          <Suspense fallback={<ThemeFormSkeleton />}>
            <ThemeForm session={session} />
          </Suspense>
        </section>
      </div>
    </>
  );
}
