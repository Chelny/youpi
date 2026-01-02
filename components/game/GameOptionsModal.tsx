"use client";

import { ChangeEvent, ReactNode, useEffect, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { ProfanityFilter } from "db/enums";
import { Socket } from "socket.io-client";
import useSWRMutation from "swr/mutation";
import { AvatarListbox } from "@/components/AvatarListbox";
import DeclineAllInvitationsCheckbox from "@/components/game/DeclineAllInvitationsCheckbox";
import Modal from "@/components/ui/Modal";
import RadioButtonGroup from "@/components/ui/RadioButtonGroup";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { fetcher } from "@/lib/fetcher";

interface GameOptionsModalProps {
  avatarId: string
  profanityFilter: ProfanityFilter
  onSetProfanityFilter: (value: ProfanityFilter) => void
  onCancel: () => void
}

export default function GameOptionsModal({
  avatarId,
  profanityFilter,
  onSetProfanityFilter,
  onCancel,
}: GameOptionsModalProps): ReactNode {
  const { t } = useLingui();
  const { socketRef, isConnected, session } = useSocket();
  const [isDeclineAll, setIsDeclineAll] = useState<boolean>(false);

  const { trigger: updateSettings, isMutating } = useSWRMutation(
    `/api/users/${session?.user.id}/settings`,
    (url: string, { arg }: { arg: { profanityFilter: ProfanityFilter } }) =>
      fetcher<{ profanityFilter: ProfanityFilter }>(url, { method: "PATCH", body: JSON.stringify(arg) }),
    {
      revalidate: false,
      onSuccess: (response: ApiResponse<{ profanityFilter: ProfanityFilter }>) => {
        if (response.success && response.data) {
          onSetProfanityFilter(response.data?.profanityFilter);
        }
      },
    },
  );

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(ClientToServerEvents.TABLE_INVITATIONS_BLOCKED_CHECK, {}, (response: SocketCallback<boolean>) => {
        if (response.success && response.data) {
          setIsDeclineAll(response.data);
        }
      });
    };

    const onConnect = (): void => {
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.once("connect", onConnect);
    }

    return () => {
      socket.off("connect", onConnect);
    };
  }, [isConnected, session?.user.id]);

  const handleToggleDeclineAll = (value: boolean): void => {
    setIsDeclineAll(value);

    socketRef.current?.emit(
      value ? ClientToServerEvents.TABLE_INVITATIONS_BLOCK : ClientToServerEvents.TABLE_INVITATIONS_ALLOW,
    );
  };

  const handleUpdateProfanityFilter = async (value: ProfanityFilter): Promise<void> => {
    await updateSettings({ profanityFilter: value });
  };

  return (
    <Modal
      title={t({ message: "Options" })}
      cancelText={t({ message: "Done" })}
      dataTestId="game-options"
      onCancel={onCancel}
    >
      <div className="flex gap-4">
        <div className="flex-1">
          <DeclineAllInvitationsCheckbox
            isDeclineAll={isDeclineAll}
            isDisabled={!isConnected}
            onToggleDeclineAll={handleToggleDeclineAll}
          />
          <RadioButtonGroup
            id="profanity-filter"
            label={t({ message: "Profanity Filter" })}
            inline
            defaultValue={profanityFilter}
            required
            disabled={!isConnected || isMutating}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const value: ProfanityFilter = event.target.value as ProfanityFilter;
              handleUpdateProfanityFilter(value);
            }}
          >
            <RadioButtonGroup.Option id="none" label={t({ message: "None" })} value={ProfanityFilter.NONE} />
            <RadioButtonGroup.Option id="weak" label={t({ message: "Weak" })} value={ProfanityFilter.WEAK} />
            <RadioButtonGroup.Option id="strong" label={t({ message: "Strong" })} value={ProfanityFilter.STRONG} />
          </RadioButtonGroup>
        </div>
        <div>
          <AvatarListbox initialAvatarId={avatarId} />
        </div>
      </div>
    </Modal>
  );
}
