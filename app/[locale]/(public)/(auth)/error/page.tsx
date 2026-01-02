"use client";

import { ReactNode, Suspense } from "react";
import { ReadonlyURLSearchParams, useSearchParams } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import GoToHomepageLink from "@/components/GoToHomepageLink";
import Anchor from "@/components/ui/Anchor";
import { APP_CONFIG } from "@/constants/app";

const generateErrorMessage = (errorCode: string, message: ReactNode): ReactNode => (
  <div className="flex flex-col gap-4">
    <p>
      <Trans>
        {message} Please try again or{" "}
        <a href={`mailto:${APP_CONFIG.EMAIL.SUPPORT}`} className="youpi-link">
          contact our support team
        </a>{" "}
        if the issue persists.
      </Trans>
    </p>
    <div>
      <Trans>
        Error code: <code className="rounded-sm p-1 bg-gray-200 text-sm">{errorCode}</code>
      </Trans>
    </div>
  </div>
);

const errorMap: Record<string, ReactNode> = {
  account_not_linked: generateErrorMessage(
    "account_not_linked",
    <>
      <Trans>The user already exists but the account isn’t linked to the provider.</Trans>
    </>,
  ),
  unable_to_create_user: generateErrorMessage(
    "unable_to_create_user",
    <>
      <Trans>We were unable to create your account at this time.</Trans>
    </>,
  ),
};

export default function AuthError(): ReactNode {
  return (
    <Suspense>
      <ErrorMessage />
    </Suspense>
  );
}

function ErrorMessage(): ReactNode {
  const searchParams: ReadonlyURLSearchParams = useSearchParams();
  const error: string = searchParams.get("error") as string;

  return (
    <div className="flex flex-col">
      <h1 className="mb-4 text-3xl">
        <Trans>Something went wrong</Trans>
      </h1>
      {errorMap[error] || (
        <div>
          <Trans>
            An unexpected error occurred. Please try again later or{" "}
            <Anchor href={`mailto:${APP_CONFIG.EMAIL.SUPPORT}`}>contact our support team</Anchor> if this issue
            continues.
          </Trans>
        </div>
      )}
      <GoToHomepageLink />
    </div>
  );
}
