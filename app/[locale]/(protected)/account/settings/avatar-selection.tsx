"use client";

import { ReactNode, useRef, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import AccountSectionHeader from "@/components/AccountSectionHeader";
import { AvatarListbox } from "@/components/AvatarListbox";
import AlertMessage from "@/components/ui/AlertMessage";
import { INITIAL_FORM_STATE } from "@/constants/api";
import { useAvatarSave } from "@/hooks/useAvatarSave";
import { Session } from "@/lib/auth-client";

type AvatarSelectionProps = {
  session: Session | null
};

export function AvatarSelection({ session }: AvatarSelectionProps): ReactNode {
  const [formState, setFormState] = useState<ApiResponse>(INITIAL_FORM_STATE);
  const { t } = useLingui();
  const { saveAvatarDebounced } = useAvatarSave();
  const autoDismissTimerRef = useRef<number | null>(null);

  const scheduleAutoDismiss = (): void => {
    if (autoDismissTimerRef.current) {
      window.clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  };

  const hideIn5s = (): void => {
    scheduleAutoDismiss();
    autoDismissTimerRef.current = window.setTimeout(() => setFormState(INITIAL_FORM_STATE), 5000);
  };

  const handleSelectedAvatar = (avatarId: string): void => {
    scheduleAutoDismiss();

    saveAvatarDebounced(avatarId, {
      onSuccess: () => {
        setFormState({ success: true, message: t({ message: "The avatar has been updated!" }) });
        hideIn5s();
      },
      onError: (message: string | undefined) => {
        setFormState({ success: false, message: message ?? t({ message: "Failed to update avatar." }) });
        hideIn5s();
      },
    });
  };

  return (
    <AccountSectionHeader title={<Trans>Avatar</Trans>} description={<Trans>Select your profile avatar.</Trans>}>
      <div className="grid w-full">
        {formState?.message && (
          <AlertMessage type={formState.success ? "success" : "error"}>{formState.message}</AlertMessage>
        )}
        <AvatarListbox
          initialAvatarId={session?.user.userSettings?.avatarId}
          layout="grid"
          onSelect={handleSelectedAvatar}
        />
      </div>
    </AccountSectionHeader>
  );
}
