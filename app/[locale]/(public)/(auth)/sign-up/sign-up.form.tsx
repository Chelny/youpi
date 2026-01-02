"use client";

import { ClipboardEvent, FormEvent, ReactNode, useState } from "react";
import { ErrorContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { ValueError } from "@sinclair/typebox/errors";
import { Value } from "@sinclair/typebox/value";
import clsx from "clsx/lite";
import {
  SignUpFormValidationErrors,
  SignUpPayload,
  signUpSchema,
} from "@/app/[locale]/(public)/(auth)/sign-up/sign-up.schema";
import AlertMessage from "@/components/ui/AlertMessage";
import Anchor from "@/components/ui/Anchor";
import Button from "@/components/ui/Button";
import Calendar from "@/components/ui/Calendar";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { CALLBACK_URL, ROUTE_PRIVACY_POLICY, ROUTE_SIGN_IN, ROUTE_TERMS_OF_SERVICE } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

type SignUpFormProps = {
  locale: string
};

export function SignUpForm({ locale }: SignUpFormProps): ReactNode {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();

  const handleSignUp = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: SignUpPayload = {
      name: formData.get("name") as string,
      birthdate: formData.get("birthdate") as string,
      email: formData.get("email") as string,
      username: formData.get("username") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
      termsAndConditions: formData.get("termsAndConditions") === "on",
    };

    const errors: ValueError[] = Array.from(Value.Errors(signUpSchema, payload));
    const errorMessages: SignUpFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "name":
          errorMessages.name = t({ message: "The name is invalid." });
          break;
        case "birthdate":
          if (payload.birthdate) {
            errorMessages.birthdate = t({ message: "The birthdate is invalid." });
          }
          break;
        case "email":
          errorMessages.email = t({ message: "The email is invalid." });
          break;
        case "username":
          errorMessages.username = t({ message: "The username is invalid." });
          break;
        case "password":
          errorMessages.password = t({ message: "The password is invalid." });
          break;
        case "confirmPassword":
          errorMessages.confirmPassword = t({ message: "The password confirmation is invalid." });
          break;
        case "termsAndConditions":
          errorMessages.termsAndConditions = t({ message: "You must accept the terms and conditions." });
          break;
        default:
          logger.warn(`Sign Up Validation: Unknown error at ${error.path}`);
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
      await authClient.signUp.email(
        {
          name: payload.name,
          birthdate: payload.birthdate ? new Date(payload.birthdate) : undefined,
          email: payload.email,
          username: payload.username,
          password: payload.password,
          language: locale,
          callbackURL: CALLBACK_URL,
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
            const email: string = payload.email;
            setFormState({
              success: true,
              message: t({
                message: `A confirmation email has been sent to ${email}. If you don’t see it in your inbox, please check your spam or junk folder.`,
              }),
            });
          },
        },
      );
    }
  };

  return (
    <form className="w-full" noValidate data-testid="sign-up_form" onSubmit={handleSignUp}>
      <p className="mb-4">
        <Trans>
          Already have an account?{" "}
          <Anchor href={ROUTE_SIGN_IN.PATH} dataTestId="sign-up_link_sign-in">
            Sign In
          </Anchor>
        </Trans>
      </p>
      {formState?.message && (
        <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
      )}
      <Input
        id="name"
        label={t({ message: "Name" })}
        placeholder={t({ message: "Enter your name" })}
        required
        dataTestId="sign-up_input-text_name"
        errorMessage={formState?.error?.name}
      />
      <Calendar
        id="birthdate"
        label={t({ message: "Birthdate" })}
        maxDate={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate())}
        dataTestId="sign-up_input-date_birthdate"
        description={t({ message: "You must be at least 13 years old." })}
        errorMessage={formState?.error?.birthdate}
      />
      <Input
        type="email"
        id="email"
        label={t({ message: "Email" })}
        placeholder={t({ message: "Enter your email" })}
        required
        dataTestId="sign-up_input-email_email"
        onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
        errorMessage={formState?.error?.email}
      />
      <hr className={clsx("mt-6 mb-4", "dark:border-slate-500")} />
      <Input
        id="username"
        label={t({ message: "Username" })}
        placeholder={t({ message: "Enter your username" })}
        autoComplete="off"
        required
        dir="ltr"
        dataTestId="sign-up_input-text_username"
        description={t({
          message:
            "Username must be between 4 and 32 characters long and can contain digits, periods, and underscores.",
        })}
        errorMessage={formState?.error?.username}
      />
      <Input
        type="password"
        id="password"
        label={t({ message: "Password" })}
        autoComplete="off"
        required
        dataTestId="sign-up_input-password_password"
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
        dataTestId="sign-up_input-password_confirm-password"
        onPaste={(event: ClipboardEvent<HTMLInputElement>) => event.preventDefault()}
        errorMessage={formState?.error?.confirmPassword}
      />
      <Checkbox
        id="termsAndConditions"
        label={
          <span>
            <Trans>
              I agree to the <Anchor href={ROUTE_TERMS_OF_SERVICE.PATH}>Terms of Service</Anchor> and{" "}
              <Anchor href={ROUTE_PRIVACY_POLICY.PATH}>Privacy Policy</Anchor>.
            </Trans>
          </span>
        }
        required
        dataTestId="sign-up_checkbox_terms-and-conditions"
        errorMessage={formState?.error?.termsAndConditions}
      />
      <Button type="submit" className="w-full" disabled={isLoading || formState.success}>
        <Trans>Sign Up</Trans>
      </Button>
    </form>
  );
}
