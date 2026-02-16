"use client";

import { ClipboardEvent, FormEvent, ReactNode, useEffect, useRef, useState } from "react";
import { ErrorContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { Value, ValueError } from "@sinclair/typebox/value";
import { Account } from "better-auth";
import {
  ChangePasswordFormValidationErrors,
  ChangePasswordPayload,
  changePasswordSchema,
  SetPasswordFormValidationErrors,
  SetPasswordPayload,
  setPasswordSchema,
} from "@/app/[locale]/(protected)/account/profile/change-password.schema";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input, { InputImperativeHandle } from "@/components/ui/Input";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { authClient } from "@/lib/auth-client";
import { Session } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

type ChangePasswordFormProps = {
  session: Session | null
};

export function ChangePasswordForm({ session }: ChangePasswordFormProps): ReactNode {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const [isUserPasswordSet, setIsUserPasswordSet] = useState<boolean>(false);
  const currentPasswordRef = useRef<InputImperativeHandle>(null);
  const newPasswordRef = useRef<InputImperativeHandle>(null);
  const confirmNewPasswordRef = useRef<InputImperativeHandle>(null);
  const { t } = useLingui();

  useEffect(() => {
    if (session) {
      const isPasswordFound: Account | undefined = session?.accounts.find((account: Account) => account.password);
      setIsUserPasswordSet(typeof isPasswordFound !== "undefined");
    }
  }, [session]);

  const handleChangeSetPassword = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    if (isUserPasswordSet) {
      handleChangePassword(event);
    } else {
      handleSetPassword(event);
    }
  };

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    const formData: FormData = new FormData(event.currentTarget);
    const payload: SetPasswordPayload = {
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const errors: ValueError[] = Array.from(Value.Errors(setPasswordSchema, payload));
    const errorMessages: SetPasswordFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "password":
          errorMessages.password = t({ message: "The password is invalid." });
          break;
        case "confirmPassword":
          errorMessages.confirmPassword = t({ message: "The password confirmation is invalid." });
          break;
        default:
          logger.warn(`Set Password Validation: Unknown error at ${error.path}`);
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
      setIsLoading(true);

      await fetch("/api/account/password", {
        method: "POST",
        body: JSON.stringify({
          password: payload.password,
        }),
      })
        .then(async (response: Response) => {
          const data: ApiResponse = await response.json();
          setIsLoading(false);
          setFormState(data);
          setIsUserPasswordSet(true);
        })
        .catch(async (error) => {
          const data: ApiResponse = await error.json();
          setIsLoading(false);
          setFormState(data);
        });
    }
  };

  const handleChangePassword = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    const formData: FormData = new FormData(event.currentTarget);
    const payload: ChangePasswordPayload = {
      currentPassword: formData.get("currentPassword") as string,
      newPassword: formData.get("newPassword") as string,
      confirmNewPassword: formData.get("confirmNewPassword") as string,
      revokeOtherSessions: formData.get("revokeOtherSessions") === "on",
    };

    const errors: ValueError[] = Array.from(Value.Errors(changePasswordSchema, payload));
    const errorMessages: ChangePasswordFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "currentPassword":
          errorMessages.currentPassword = t({ message: "The current password is invalid." });
          break;
        case "newPassword":
          errorMessages.newPassword = t({ message: "The new password is invalid." });
          break;
        case "confirmNewPassword":
          errorMessages.confirmNewPassword = t({ message: "The new password confirmation is invalid." });
          break;
        default:
          logger.warn(`Change Password Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (payload.newPassword !== payload.confirmNewPassword) {
      errorMessages.confirmNewPassword = t({ message: "The new password and new password confirmation do not match." });
    }

    if (Object.keys(errorMessages).length > 0) {
      setFormState({
        success: false,
        message: t({ message: "Validation errors occurred." }),
        error: errorMessages,
      });
    } else {
      await authClient.changePassword(
        {
          newPassword: payload.newPassword,
          currentPassword: payload.currentPassword,
          revokeOtherSessions: payload.revokeOtherSessions,
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
              message: t({ message: "The password has been updated!" }),
            });
            currentPasswordRef.current?.clear();
            newPasswordRef.current?.clear();
            confirmNewPasswordRef.current?.clear();
          },
        },
      );
    }
  };

  return (
    <AccountSectionHeader
      title={<Trans>Password</Trans>}
      description={<Trans>Enter your current password to make an update.</Trans>}
    >
      <form className="grid w-full" noValidate onSubmit={handleChangeSetPassword}>
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <>
          {isUserPasswordSet && (
            <Input
              ref={currentPasswordRef}
              type="password"
              id="currentPassword"
              label={t({ message: "Current Password" })}
              autoComplete="off"
              required
              dataTestId="change-password_input-password_current-password"
              errorMessage={formState?.error?.currentPassword}
            />
          )}
          <Input
            ref={newPasswordRef}
            type="password"
            id={isUserPasswordSet ? "newPassword" : "password"}
            label={isUserPasswordSet ? t({ message: "New Password" }) : t({ message: "Password" })}
            autoComplete="off"
            required
            dataTestId={
              isUserPasswordSet ? "change-password_input-password_new-password" : "set-password_input-password_password"
            }
            description={t({
              message:
                "Password must be at least 8 characters long, must contain at least one digit, one uppercase letter, and at least one special character.",
            })}
            errorMessage={isUserPasswordSet ? formState?.error?.newPassword : formState?.error?.password}
          />
          <Input
            ref={confirmNewPasswordRef}
            type="password"
            id={isUserPasswordSet ? "confirmNewPassword" : "confirmPassword"}
            label={isUserPasswordSet ? t({ message: "Confirm New Password" }) : t({ message: "Confirm Password" })}
            autoComplete="off"
            required
            dataTestId={
              isUserPasswordSet
                ? "change-password_input-password_confirm-new-password"
                : "set-password_input-password_confirm-password"
            }
            onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
            errorMessage={isUserPasswordSet ? formState?.error?.confirmNewPassword : formState?.error?.confirmPassword}
          />
          {isUserPasswordSet && (
            <Checkbox
              id="revokeOtherSessions"
              label={t({ message: "Revoke all other sessions" })}
              dataTestId="change-password_checkbox_revoke-other-sessions"
              errorMessage={formState?.error?.revokeOtherSessions}
            />
          )}
        </>
        <Button type="submit" className="max-md:w-full md:place-self-end" disabled={isLoading}>
          {isUserPasswordSet ? t({ message: "Change Password" }) : t({ message: "Set Password" })}
        </Button>
      </form>
    </AccountSectionHeader>
  );
}
