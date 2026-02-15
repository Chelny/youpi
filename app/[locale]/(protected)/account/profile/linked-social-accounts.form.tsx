"use client";

import { ReactNode, useEffect, useState } from "react";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { ErrorContext, SuccessContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { Account } from "better-auth";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { AUTH_PROVIDERS } from "@/constants/auth-providers";
import { ROUTE_PROFILE } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";
import { AuthProvider, AuthProviderDetails } from "@/lib/providers";

export function LinkedSocialAccountsForm(): ReactNode {
  const searchParams: ReadonlyURLSearchParams = useSearchParams();
  const errorParam: string | null = searchParams.get("error");
  const [accountList, setAccountsList] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();

  const errorMessages: Record<string, string> = {
    "email_doesn't_match": t({
      message: "The email you provided does not match the one associated with your account.",
    }),
  };

  const getLinkedAccounts = async (): Promise<void> => {
    await authClient.listAccounts(
      {},
      {
        onRequest: () => {
          setIsLoading(true);
        },
        onResponse: () => {
          setIsLoading(false);
        },
        onSuccess: (ctx: SuccessContext<Account[]>) => {
          setAccountsList(ctx.data);
        },
      },
    );
  };

  const isProviderLinked = (providerName: AuthProvider): boolean =>
    accountList.some((account: Account) => account.providerId === providerName);

  const handleLinkUnlink = async (providerName: AuthProvider): Promise<void> => {
    if (isProviderLinked(providerName)) {
      await authClient.unlinkAccount(
        {
          providerId: providerName,
        },
        {
          onRequest: () => {
            setIsLoading(true);
            setFormState(INITIAL_FORM_STATE);
          },
          onResponse: () => {
            setIsLoading(false);
          },
          onError: (ctx: ErrorContext) => {
            setFormState({
              success: false,
              message: ctx.error.message,
            });
          },
          onSuccess: async () => {
            setFormState({
              success: true,
              message: t({ message: "The account has been unlinked!" }),
            });
            await getLinkedAccounts();
          },
        },
      );
    } else {
      // Link the account
      await authClient.linkSocial(
        {
          provider: providerName,
          callbackURL: ROUTE_PROFILE.PATH,
        },
        {
          onRequest: () => {
            setIsLoading(true);
            setFormState(INITIAL_FORM_STATE);
          },
          onResponse: () => {
            setIsLoading(false);
          },
          onError: (ctx: ErrorContext) => {
            setFormState({
              success: false,
              message: ctx.error.message,
            });
          },
          onSuccess: async () => {
            setFormState({
              success: true,
              message: t({ message: "The account has been linked!" }),
            });
            await getLinkedAccounts();
          },
        },
      );
    }
  };

  useEffect(() => {
    if (errorParam && errorMessages[errorParam]) {
      setFormState({
        success: false,
        message: errorMessages[errorParam],
      });
    }

    getLinkedAccounts();
  }, []);

  return (
    <AccountSectionHeader
      title={<Trans>Linked Social Accounts</Trans>}
      description={<Trans>Connect or disconnect social accounts used to sign in.</Trans>}
    >
      <div>
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <ul className="flex flex-col gap-4">
          {AUTH_PROVIDERS.map(({ name, label, icon }: AuthProviderDetails) => {
            return (
              <li key={name} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span>{label}</span>
                </div>
                <Button
                  type="button"
                  className="w-30"
                  disabled={isLoading}
                  aria-label={
                    isProviderLinked(name) ? t({ message: `Unlink ${label}` }) : t({ message: `Link ${label}` })
                  }
                  onClick={() => handleLinkUnlink(name)}
                >
                  {isProviderLinked(name) ? t({ message: "Unlink" }) : t({ message: "Link" })}
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </AccountSectionHeader>
  );
}
