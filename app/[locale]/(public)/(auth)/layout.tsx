import { ReactNode } from "react";
import { I18n } from "@lingui/core";
import clsx from "clsx/lite";
import { getI18nInstance } from "@/app/app-router-i18n";
import LocaleSwitcher from "@/components/LanguageSwitcher";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import Anchor from "@/components/ui/Anchor";
import { ROUTE_SIGN_IN, ROUTE_SIGN_UP } from "@/constants/routes";

type AuthLayoutProps = LayoutProps<"/[locale]"> & {
  breadcrumb: ReactNode
};

export default async function AuthLayout({ params, children }: AuthLayoutProps): Promise<ReactNode> {
  const { locale } = await params;
  const i18n: I18n = getI18nInstance(locale);

  return (
    <div className="grid grid-rows-[max-content_auto_max-content] h-dvh">
      <Header>
        <nav className="flex-1 flex flex-row justify-end items-center gap-2">
          <LocaleSwitcher className="place-self-end" />
          <ul
            className={clsx(
              "flex flex-row justify-end divide-x divide-white/50",
              "[&_li]:not-last:pe-2 [&_li]:not-first:not-last:px-2 [&_li]:last:ps-2",
            )}
          >
            <li>
              <Anchor href={ROUTE_SIGN_IN.PATH} className={clsx("px-1 text-white", "hover:text-white/50")}>
                {i18n._(ROUTE_SIGN_IN.TITLE)}
              </Anchor>
            </li>
            <li>
              <Anchor href={ROUTE_SIGN_UP.PATH} className={clsx("px-1 text-white", "hover:text-white/50")}>
                {i18n._(ROUTE_SIGN_UP.TITLE)}
              </Anchor>
            </li>
          </ul>
        </nav>
      </Header>
      <main className={clsx("flex-1 flex flex-col gap-6 px-4 py-8 overflow-auto", "sm:w-md sm:mx-auto")}>
        {children}
      </main>
      <Footer />
    </div>
  );
}
