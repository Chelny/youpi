"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorContext } from "@better-fetch/fetch";
import { Trans, useLingui } from "@lingui/react/macro";
import { Value, ValueError } from "@sinclair/typebox/value";
import {
  PersonalInformationFormValidationErrors,
  PersonalInformationPayload,
  profileSchema,
} from "@/app/[locale]/(protected)/account/profile/personal-information.schema";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import Calendar from "@/components/ui/Calendar";
import Input from "@/components/ui/Input";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { ROUTE_TOWERS } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";
import { Session } from "@/lib/auth-client";
import { logger } from "@/lib/logger";

type PersonalInformationFormProps = {
  session: Session | null
  isNewUser?: boolean
};

export function PersonalInformationForm({ session, isNewUser }: PersonalInformationFormProps): ReactNode {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();

  const handleUpdatePersonalInfo = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    const formData: FormData = new FormData(event.currentTarget);
    const payload: PersonalInformationPayload = {
      name: formData.get("name") as string,
      birthdate: formData.get("birthdate") as string,
      username: formData.get("username") as string,
    };

    const errors: ValueError[] = Array.from(Value.Errors(profileSchema, payload));
    const errorMessages: PersonalInformationFormValidationErrors = {};

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
        case "username":
          errorMessages.username = t({ message: "The username is invalid." });
          break;
        default:
          logger.warn(`Personal Information Validation: Unknown error at ${error.path}`);
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
      await authClient.updateUser(
        {
          name: payload.name,
          birthdate: payload.birthdate ? new Date(payload.birthdate) : undefined,
          ...(payload.username !== session?.user.username ? { username: payload.username } : {}),
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
              message: !!isNewUser
                ? t({ message: "Your profile has been updated! You will be redirected in 3 seconds..." })
                : t({ message: "Your profile has been updated!" }),
            });

            if (!!isNewUser) {
              setTimeout(() => {
                router.push(ROUTE_TOWERS.PATH);
              }, 3000);
            }
          },
        },
      );
    }
  };

  return (
    <AccountSectionHeader
      title={<Trans>Personal Information</Trans>}
      description={<Trans>Update your personal details here.</Trans>}
      isNewUser={isNewUser}
    >
      <form className="grid w-full" noValidate onSubmit={handleUpdatePersonalInfo}>
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <Input
          id="name"
          label={t({ message: "Name" })}
          placeholder={t({ message: "Enter your name" })}
          defaultValue={session?.user?.name}
          required
          dataTestId="profile_input-text_name"
          errorMessage={formState?.error?.name}
        />
        <Calendar
          id="birthdate"
          label={t({ message: "Birthdate" })}
          maxDate={new Date(new Date().getFullYear() - 13, new Date().getMonth(), new Date().getDate())}
          defaultValue={session?.user?.birthdate ? String(new Date(session?.user?.birthdate)) : undefined}
          dataTestId="profile_input-date_birthdate"
          description={t({ message: "You must be at least 13 years old." })}
          errorMessage={formState?.error?.birthdate}
        />
        <Input
          id="username"
          label={t({ message: "Username" })}
          placeholder={t({ message: "Enter your username" })}
          autoComplete="off"
          defaultValue={session?.user?.username}
          required
          dir="ltr"
          dataTestId="profile_input-text_username"
          description={t({
            message:
              "Username must be between 4 and 32 characters long and can contain digits, periods, and underscores.",
          })}
          errorMessage={formState?.error?.username}
        />
        <Button
          type="submit"
          className={!!isNewUser ? "w-full" : "max-md:w-full md:place-self-end"}
          disabled={isLoading}
        >
          {!!isNewUser ? t({ message: "Complete Registration" }) : t({ message: "Update Profile" })}
        </Button>
      </form>
    </AccountSectionHeader>
  );
}
