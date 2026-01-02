"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { ValueError } from "@sinclair/typebox/errors";
import { Value } from "@sinclair/typebox/value";
import clsx from "clsx/lite";
import { PiKeyFill, PiMagicWandFill } from "react-icons/pi";
import {
  SignInFormValidationErrors,
  SignInPayload,
  signInSchema,
} from "@/app/[locale]/(public)/(auth)/sign-in/sign-in.schema";
import AlertMessage from "@/components/ui/AlertMessage";
import Anchor from "@/components/ui/Anchor";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { AUTH_PROVIDERS } from "@/constants/auth-providers";
import {
  CALLBACK_URL,
  ERROR_CALLBACK_URL,
  NEW_USER_CALLBACK_URL,
  ROUTE_FORGOT_PASSWORD,
  ROUTE_PRIVACY_POLICY,
  ROUTE_SIGN_IN_WITH_MAGIC_LINK,
  ROUTE_SIGN_UP,
  ROUTE_TERMS_OF_SERVICE,
} from "@/constants/routes";
import { authClient } from "@/lib/auth-client";
import { logger } from "@/lib/logger";
import { AuthProvider, AuthProviderDetails } from "@/lib/providers";

export function SignInForm(): ReactNode {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();

  const handleSignIn = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: SignInPayload = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      rememberMe: formData.get("rememberMe") === "on",
    };

    const errors: ValueError[] = Array.from(Value.Errors(signInSchema, payload));
    const errorMessages: SignInFormValidationErrors = {};

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "email":
          errorMessages.email = t({ message: "The email is invalid." });
          break;
        case "password":
          errorMessages.password = t({ message: "The password is invalid." });
          break;
        default:
          logger.warn(`Sign In Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (Object.keys(errorMessages).length > 0) {
      setFormState({
        success: false,
        message: t({ message: "The email or the password is invalid." }),
        error: errorMessages,
      });
    } else {
      await authClient.signIn.email(
        {
          email: payload.email,
          password: payload.password,
          rememberMe: payload.rememberMe,
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
            setFormState({
              success: true,
              message: t({ message: "You’re signed in successfully. Welcome back!" }),
            });
          },
        },
      );
    }
  };

  const handleSignInWithMagicLink = (): void => router.push(ROUTE_SIGN_IN_WITH_MAGIC_LINK.PATH);

  const handleSignInWithProvider = async (provider: AuthProvider): Promise<void> => {
    await authClient.signIn.social(
      {
        provider: provider,
        newUserCallbackURL: NEW_USER_CALLBACK_URL,
        callbackURL: CALLBACK_URL,
        errorCallbackURL: ERROR_CALLBACK_URL,
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
            message: t({ message: "You’re signed in successfully. Welcome back!" }),
          });
        },
      },
    );
  };

  const handleSignInWithPasskey = async (): Promise<void> => {
    await authClient.signIn.passkey(
      {
        autoFill: true,
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
            message: t({ message: "You’re signed in successfully. Welcome back!" }),
          });
        },
      },
    );
  };

  return (
    <form className="w-full" noValidate onSubmit={handleSignIn}>
      {!formState.success && formState.message && <AlertMessage type="error">{formState.message}</AlertMessage>}
      <Input
        type="email"
        id="email"
        label={t({ message: "Email" })}
        autoComplete="username webauthn"
        required
        dataTestId="sign-in_input-email_email"
      />
      <Input
        type="password"
        id="password"
        label={t({ message: "Password" })}
        autoComplete="current-password webauthn"
        required
        dataTestId="sign-in_input-password_password"
      />
      <div className="flex items-center">
        <div className="flex-1">
          <Checkbox
            id="rememberMe"
            label={t({ message: "Remember me" })}
            defaultChecked={true}
            dataTestId="sign-in_checkbox_remember-me"
          />
        </div>
        <div className="flex-1 mb-3 text-end">
          <Anchor href={ROUTE_FORGOT_PASSWORD.PATH} dataTestId="sign-in_link_forgot-password">
            {t({ message: "Forgot Password" })}
          </Anchor>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full"
        dataTestId="sign-in_button_sign-in-with-email-and-password"
        aria-label={t({ message: "Sign in with email and password" })}
        disabled={isLoading}
      >
        {t({ message: "Sign In" })}
      </Button>
      <div className="flex justify-center gap-1 my-4 text-center">
        <Trans>
          <span>Don’t have an account?</span>{" "}
          <Anchor href={ROUTE_SIGN_UP.PATH} dataTestId="sign-in_link_sign-up">
            Sign Up
          </Anchor>
        </Trans>
      </div>
      <div className="flex justify-between items-center mt-4 mb-6" role="separator">
        <hr className={clsx("flex-1 me-4 border border-neutral-200", "dark:border-slate-600")} />
        <span className={clsx("mx-auto text-gray-600 text-sm uppercase", "dark:text-gray-400")}>
          <Trans>or sign in with</Trans>
        </span>
        <hr className={clsx("flex-1 h-0 ms-4 border border-neutral-200", "dark:border-slate-600")} />
      </div>
      <div className="flex flex-col gap-4">
        <Button
          className="flex justify-center items-center w-full gap-x-2"
          disabled={isLoading}
          dataTestId="sign-in_button_sign-in-with-magic-link"
          onClick={handleSignInWithMagicLink}
        >
          <PiMagicWandFill className="w-5 h-5" aria-hidden="true" />
          <span>{t({ message: "Magic Link" })}</span>
        </Button>
        <div className="flex gap-2">
          {AUTH_PROVIDERS.map(({ name, label: provider, icon }: AuthProviderDetails) => (
            <Button
              key={name}
              type="button"
              className="flex-1 flex justify-center items-center gap-2 w-full"
              disabled={isLoading}
              dataTestId={`sign-in_button_sign-in-with-${name}`}
              aria-label={t({ message: `Sign in with ${provider}` })}
              onClick={() => handleSignInWithProvider(name)}
            >
              {icon}
              <span>{provider}</span>
            </Button>
          ))}
        </div>
        <Button
          className="flex justify-center items-center w-full gap-x-2"
          disabled={isLoading || true} // FIXME: Passkey can't sign in
          dataTestId="sign-in_button_sign-in-with-passkey"
          onClick={() => handleSignInWithPasskey()}
        >
          <PiKeyFill className="w-5 h-5" aria-hidden="true" />
          <span>{t({ message: "Passkey" })}</span>
        </Button>
      </div>
      <div className="mt-4 text-center">
        <Trans>
          By signing in, you agree to our <Anchor href={ROUTE_TERMS_OF_SERVICE.PATH}>Terms of Service</Anchor> and{" "}
          <Anchor href={ROUTE_PRIVACY_POLICY.PATH}>Privacy Policy</Anchor>.
        </Trans>
      </div>
    </form>
  );
}
