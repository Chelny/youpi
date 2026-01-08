"use client";

import { InputEvent, ReactNode, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { RoomLevel } from "db/browser";
import DeclineAllInvitationsCheckbox from "@/components/game/DeclineAllInvitationsCheckbox";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { TableInvitationPlainObject } from "@/server/towers/classes/TableInvitation";

type TableInvitationModalProps = {
  tableInvitation: TableInvitationPlainObject
  onAcceptInvitation: (roomId: string, tableId: string) => void
  onCancel: () => void
  onClose: () => void
};

export default function TableInvitationModal({
  tableInvitation,
  onAcceptInvitation,
  onCancel,
  onClose,
}: TableInvitationModalProps): ReactNode {
  const { isConnected, socketRef } = useSocket();
  const { t } = useLingui();
  const [reason, setReason] = useState<string>("");
  const [isDeclineAll, setIsDeclineAll] = useState<boolean>(false);
  const username: string | undefined = tableInvitation.inviterPlayer.user.username;
  const rating: number | undefined = tableInvitation.inviterPlayer.stats?.rating;
  const isRatingVisible: boolean = tableInvitation.room.level !== RoomLevel.SOCIAL;
  const inviterInfo: string = isRatingVisible ? `${username} (${rating})` : username;
  const tableNumber: number = tableInvitation.table.tableNumber;
  const ratedOption: string = tableInvitation.table.isRated ? t({ message: "Rated" }) : t({ message: "Not Rated" });

  const handleAcceptInvitation = (): void => {
    socketRef.current?.emit(
      ClientToServerEvents.TABLE_INVITATION_ACCEPT,
      { invitationId: tableInvitation.id },
      (response: SocketCallback) => {
        if (response.success) {
          onAcceptInvitation(tableInvitation.roomId, tableInvitation.tableId);
          onCancel?.();
        }
      },
    );
  };

  const handleDeclineInvitation = (): void => {
    socketRef.current?.emit(
      ClientToServerEvents.TABLE_INVITATION_DECLINE,
      {
        invitationId: tableInvitation.id,
        reason,
        isDeclineAll: isDeclineAll,
      },
      (response: SocketCallback) => {
        if (response.success) {
          onCancel?.();
        }
      },
    );
  };

  return (
    <Modal
      title={t({ message: "Invited" })}
      confirmText={t({ message: "Accept" })}
      cancelText={t({ message: "Decline" })}
      dataTestId="table-invitation"
      onConfirm={handleAcceptInvitation}
      onCancel={handleDeclineInvitation}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        <div>
          <Trans>
            {inviterInfo} has invited you to table #{tableNumber}.
          </Trans>
        </div>
        <div>
          <Trans>Game option: {ratedOption}</Trans>
        </div>
        <div>
          <Trans>Would you like to join?</Trans>
        </div>
        <div>
          <Input
            id="reason"
            label={t({ message: "Reason" })}
            defaultValue={reason}
            dataTestId="table-invitation_input-text_reason"
            onInput={(event: InputEvent<HTMLInputElement>) => setReason(event.currentTarget.value)}
          />
          <DeclineAllInvitationsCheckbox
            isDeclineAll={isDeclineAll}
            isDisabled={!isConnected}
            onToggleDeclineAll={(value: boolean) => setIsDeclineAll(value)}
          />
        </div>
      </div>
    </Modal>
  );
}
