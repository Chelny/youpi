"use client";

import { useRouter } from "next/navigation";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { NotificationType } from "db/browser";
import { MdOutlineDelete } from "react-icons/md";
import AlertModal from "@/components/game/AlertModal";
import TableInvitationModal from "@/components/game/TableInvitationModal";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { NotificationPlainObject } from "@/server/towers/classes/Notification";

type NotificationDropdownItemProps = {
  notification: NotificationPlainObject
};

export const NotificationDropdownItem = ({ notification }: NotificationDropdownItemProps) => {
  const router = useRouter();
  const { i18n, t } = useLingui();
  const { openModal, closeModal } = useModal();
  const { socketRef } = useSocket();

  const setNotificationLabel = (): string => {
    switch (notification.type) {
      case NotificationType.TABLE_INVITE:
        return i18n._("Invitation to table #{tableNumber}", {
          tableNumber: notification.tableInvitation?.table.tableNumber,
        });

      case NotificationType.TABLE_INVITE_DECLINED:
        return notification.tableInvitation?.declinedReason
          ? i18n._("{username} declined your invitation. Reason: {reason}", {
              username: notification.tableInvitation?.inviteePlayer.user.username,
              reason: notification.tableInvitation?.declinedReason,
            })
          : i18n._("{username} declined your invitation.", {
              username: notification.tableInvitation?.inviteePlayer.user.username,
            });

      case NotificationType.TABLE_BOOTED:
        return i18n._("You have been booted from table #{tableNumber} by {host}.", {
          tableNumber: notification.bootedFromTable?.table.tableNumber,
          host: notification.bootedFromTable?.table.hostPlayer.user.username,
        });

      default:
        return "";
    }
  };

  const handleOpenNotificationModal = (): void => {
    switch (notification.type) {
      case NotificationType.TABLE_INVITE:
        if (!notification.tableInvitation) return;
        openModal(TableInvitationModal, {
          tableInvitation: notification.tableInvitation,
          onAcceptInvitation: (roomId: string, tableId: string): void => {
            closeModal();
            router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}&table=${tableId}`);
          },
          onCancel: (): void => {
            handleRemoveNotification();
          },
          onClose: (): void => {
            handleMarkNotificationAsRead();
          },
        });
        break;

      case NotificationType.TABLE_INVITE_DECLINED:
        if (!notification.tableInvitation) return;
        openModal(AlertModal, {
          title: t({ message: "Invitation Declined" }),
          message: notification.tableInvitation.declinedReason
            ? i18n._("{username} declined your invitation. Reason: {reason}", {
                username: notification.tableInvitation.inviteePlayer.user.username,
                reason: notification.tableInvitation.declinedReason,
              })
            : i18n._("{username} declined your invitation.", {
                username: notification.tableInvitation.inviteePlayer.user.username,
              }),
          testId: "table-invite-declined",
          onClose: (): void => {
            handleMarkNotificationAsRead();
          },
        });
        break;

      case NotificationType.TABLE_BOOTED:
        if (!notification.bootedFromTable) return;
        openModal(AlertModal, {
          title: t({ message: "Booted from table" }),
          message: i18n._("You have been booted from table #{tableNumber} by {host}.", {
            tableNumber: notification.bootedFromTable.table.tableNumber,
            host: notification.bootedFromTable.table.hostPlayer.user.username,
          }),
          testId: "booted-user",
          onClose: (): void => {
            handleMarkNotificationAsRead();
          },
        });
        break;
    }
  };

  const handleMarkNotificationAsRead = (): void => {
    if (!notification.readAt) {
      socketRef.current?.emit(ClientToServerEvents.NOTIFICATION_MARK_AS_READ, { notificationId: notification.id });
    }
  };

  const handleRemoveNotification = (): void => {
    socketRef.current?.emit(ClientToServerEvents.NOTIFICATION_DELETE, { notificationId: notification.id });
  };

  return (
    <li className="flex justify-between items-center gap-2 w-full cursor-pointer hover:bg-slate-700">
      <button
        type="button"
        className={clsx("flex-1 px-2 py-1 text-start", notification.readAt ? "font-normal" : "font-semibold")}
        onClick={handleOpenNotificationModal}
      >
        {setNotificationLabel()}
      </button>

      <button
        type="button"
        className="p-2 text-red-500"
        aria-label={t({ message: "Delete notification" })}
        onClick={handleRemoveNotification}
      >
        <MdOutlineDelete aria-hidden="true" />
      </button>
    </li>
  );
};
