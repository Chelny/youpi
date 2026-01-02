import { ReactNode } from "react";
import { I18n } from "@lingui/core";
import clsx from "clsx/lite";
import { getI18nInstance } from "@/app/app-router-i18n";
import Anchor from "@/components/ui/Anchor";
import {
  ROUTE_ACCOUNT,
  ROUTE_DELETE_ACCOUNT,
  ROUTE_PROFILE,
  ROUTE_RELATIONSHIPS,
  ROUTE_SETTINGS,
} from "@/constants/routes";

type AccountLayoutProps = LayoutProps<"/[locale]/account">;

export default async function AccountLayout({ params, children }: AccountLayoutProps): Promise<ReactNode> {
  const { locale } = await params;
  const i18n: I18n = getI18nInstance(locale);

  return (
    <div className="grid grid-cols-[max-content_1fr] gap-8 max-w-5xl px-4 py-8 mx-auto">
      <aside className="w-40">
        <nav>
          <h3 className="mt-1 mb-4 text-2xl">{i18n._(ROUTE_ACCOUNT.TITLE)}</h3>
          <ul>
            <li className="py-1">
              <Anchor href={ROUTE_PROFILE.PATH}>{i18n._(ROUTE_PROFILE.TITLE)}</Anchor>
            </li>
            <li className="py-1">
              <Anchor href={ROUTE_RELATIONSHIPS.PATH}>{i18n._(ROUTE_RELATIONSHIPS.TITLE)}</Anchor>
            </li>
            <li className="py-1">
              <Anchor href={ROUTE_SETTINGS.PATH}>{i18n._(ROUTE_SETTINGS.TITLE)}</Anchor>
            </li>
            <li className="py-1">
              <Anchor
                href={ROUTE_DELETE_ACCOUNT.PATH}
                className={clsx("text-red-500 hover:text-red-600", "text-red-400 dark:hover:text-red-300")}
              >
                {i18n._(ROUTE_DELETE_ACCOUNT.TITLE)}
              </Anchor>
            </li>
          </ul>
        </nav>
      </aside>
      <div>{children}</div>
    </div>
  );
}
