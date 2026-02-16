"use client";

import { ClipboardEvent, FormEvent, ReactNode, useEffect, useState } from "react";
import { ReadonlyURLSearchParams, useRouter, useSearchParams } from "next/navigation";
import { ErrorContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { ValueError } from "@sinclair/typebox/errors";
import { Value } from "@sinclair/typebox/value";
import {
  ResetPasswordFormValidationErrors,
  ResetPasswordPayload,
  resetPasswordSchema,
} from "@/app/[locale]/(public)/(auth)/reset-password/reset-password.schema";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { ROUTE_SIGN_IN } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

export function ResetPasswordForm(): ReactNode {
  const router = useRouter();
  const searchParams: ReadonlyURLSearchParams = useSearchParams();
  const token: string | null = searchParams.get("token");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();

  useEffect(() => {
    if (formState?.success) {
      setTimeout(() => {
        router.push(ROUTE_SIGN_IN.PATH);
      }, 3000);
    }
  }, [formState]);

  const handleResetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: ResetPasswordPayload = {
      token: formData.get("token") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const errors: ValueError[] = Array.from(Value.Errors(resetPasswordSchema, payload));
    const errorMessages: ResetPasswordFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "token":
          errorMessages.token = t({ message: "The token is missing or invalid." });
          break;
        case "password":
          errorMessages.password = t({ message: "The password is invalid." });
          break;
        case "confirmPassword":
          errorMessages.confirmPassword = t({ message: "The password confirmation is invalid." });
          break;
        default:
          logger.warn(`Reset Password Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (payload.password !== payload.confirmPassword) {
      errorMessages.confirmPassword = t({ message: "The password and password confirmation do not match." });
    }

    if (Object.keys(errorMessages).length > 0) {
      setFormState({
        success: false,
        message: t({ message: "Validation errors occurred." }),
        error: errorMessages,
      });
    } else {
      await authClient.resetPassword(
        {
          newPassword: payload.password,
          token: payload.token,
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
          onSuccess: () => {
            setFormState({
              success: true,
              message: t({
                message: "The password has been reset! You will be redirected to the sign in page in 3 seconds...",
              }),
            });
          },
        },
      );
    }
  };

  return (
    <form className="w-full" noValidate onSubmit={handleResetPassword}>
      {formState?.message && (
        <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
      )}
      <input
        type="hidden"
        id="token"
        name="token"
        value={token ?? undefined}
        data-testid="reset-password_input-hidden_token"
        required
      />
      <Input
        type="password"
        id="password"
        label={t({ message: "Password" })}
        autoComplete="off"
        required
        disabled={formState?.success}
        dataTestId="reset-password_input-password_password"
        description={t({
          message:
            "Password must be at least 8 characters long, must contain at least one digit, one uppercase letter, and at least one special character.",
        })}
        errorMessage={formState?.error?.password}
      />
      <Input
        type="password"
        id="confirmPassword"
        label={t({ message: "Confirm Password" })}
        autoComplete="off"
        required
        disabled={formState?.success}
        dataTestId="reset-password_input-password_confirm-password"
        onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
        errorMessage={formState?.error?.confirmPassword}
      />
      <Button type="submit" className="w-full" disabled={isLoading || formState?.success}>
        <Trans>Reset Password</Trans>
      </Button>
    </form>
  );
}
