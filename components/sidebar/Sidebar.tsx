"use client";

import { ReactNode, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { BsArrowsCollapseVertical, BsArrowsExpandVertical } from "react-icons/bs";
import { LuGamepad2 } from "react-icons/lu";
import { TbTower } from "react-icons/tb";
import { Socket } from "socket.io-client";
import SidebarMenuItem from "@/components/sidebar/SidebarMenuItem";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { GameRoomSummary, GameTableSummary, useGame } from "@/context/GameContext";
import { useSocket } from "@/context/SocketContext";
import { SidebarMenuActionItem, SidebarMenuLinkItem } from "@/interfaces/sidebar-menu";
import { SocketCallback } from "@/interfaces/socket";
import { NotificationPlainObject } from "@/server/towers/classes/Notification";

export default function Sidebar(): ReactNode {
  const { i18n, t } = useLingui();
  const { socketRef, isConnected } = useSocket();
  const { joinedRooms, joinedTables } = useGame();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [gameMenuItems, setGameMenuItems] = useState<SidebarMenuLinkItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationPlainObject[]>([]);
  const sidebarId: string = "app-sidebar";

  useEffect(() => {
    const items: SidebarMenuLinkItem[] = joinedRooms.map((room: GameRoomSummary) => {
      const roomNotifications: NotificationPlainObject[] = notifications.filter(
        (notification: NotificationPlainObject) => notification.roomId === room.id,
      );

      const unreadRoomNotifications: NotificationPlainObject[] = roomNotifications.filter(
        (notification: NotificationPlainObject) => !notification.readAt,
      );

      const tables: SidebarMenuLinkItem[] = joinedTables
        .filter((table: GameTableSummary) => table.roomId === room.id)
        .map((table: GameTableSummary) => ({
          id: `table-${table.id}`,
          label: i18n._("Table #{tableNumber}", { tableNumber: table.tableNumber }),
          href: `${room.basePath}?room=${room.id}&table=${table.id}`,
        }));

      return {
        id: `room-${room.id}`,
        label: room.name,
        href: `${room.basePath}?room=${room.id}`,
        children: [
          {
            id: `notifications-${room.id}`,
            label: t({ message: "Notifications" }),
            children: roomNotifications,
            unreadCount: unreadRoomNotifications.length,
          } satisfies SidebarMenuActionItem,
          ...tables,
        ],
      };
    });

    setGameMenuItems(items);
  }, [joinedRooms, joinedTables, notifications]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const emitInitialData = (): void => {
      socket.emit(ClientToServerEvents.NOTIFICATIONS, {}, (response: SocketCallback<NotificationPlainObject[]>) => {
        if (response.success && response.data) {
          setNotifications(response.data);
        }
      });
    };

    const handleUpdateNotification = ({ notification }: { notification: NotificationPlainObject }): void => {
      setNotifications((prev: NotificationPlainObject[]) =>
        prev.some((n: NotificationPlainObject) => n.id === notification.id)
          ? prev.map((n: NotificationPlainObject) => (n.id === notification.id ? { ...n, ...notification } : n))
          : [...prev, notification],
      );
    };

    const handleDeleteNotification = ({ notificationId }: { notificationId: string }): void => {
      setNotifications((prev: NotificationPlainObject[]) =>
        prev.filter((notification: NotificationPlainObject) => notification.id !== notificationId),
      );
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.TABLE_INVITATION_INVITED_NOTIFICATION, handleUpdateNotification);
      socket.on(ServerToClientEvents.TABLE_INVITATION_DECLINED_NOTIFICATION, handleUpdateNotification);
      socket.on(ServerToClientEvents.TABLE_BOOTED_NOTIFICATION, handleUpdateNotification);
      socket.on(ServerToClientEvents.NOTIFICATION_MARK_AS_READ, handleUpdateNotification);
      socket.on(ServerToClientEvents.NOTIFICATION_DELETE, handleDeleteNotification);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.TABLE_INVITATION_INVITED_NOTIFICATION, handleUpdateNotification);
      socket.off(ServerToClientEvents.TABLE_INVITATION_DECLINED_NOTIFICATION, handleUpdateNotification);
      socket.off(ServerToClientEvents.TABLE_BOOTED_NOTIFICATION, handleUpdateNotification);
      socket.off(ServerToClientEvents.NOTIFICATION_MARK_AS_READ, handleUpdateNotification);
      socket.off(ServerToClientEvents.NOTIFICATION_DELETE, handleDeleteNotification);
    };

    const onConnect = (): void => {
      attachListeners();
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socket.once("connect", onConnect);
    }

    return () => {
      socket.off("connect", onConnect);
      detachListeners();
    };
  }, [isConnected]);

  return (
    <aside
      id={sidebarId}
      className={clsx(
        "relative shrink-0 flex flex-col gap-2 min-w-24 h-full px-2 py-2 bg-sidebar-background text-white/90 transition duration-500 ease-in-out",
        isExpanded ? "w-72 items-start" : "w-24 items-center",
      )}
    >
      {/* Screen reader announcement area */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {notifications.some((notification: NotificationPlainObject) => !notification.readAt)
          ? t({ message: "You have new notifications." })
          : ""}
      </div>

      <nav className="flex flex-col items-center w-full" aria-label={t({ message: "Primary navigation" })}>
        <div className="absolute z-dropdown top-4.5 -end-4">
          <button
            type="button"
            title={isExpanded ? t({ message: "Collapse sidebar" }) : t({ message: "Expand sidebar" })}
            aria-label={isExpanded ? t({ message: "Collapse sidebar" }) : t({ message: "Expand sidebar" })}
            aria-expanded={isExpanded}
            aria-controls={sidebarId}
            onClick={() => setIsExpanded((v) => !v)}
          >
            {isExpanded ? (
              <BsArrowsCollapseVertical
                className={clsx("w-8 h-8 p-1 rounded shadow-lg bg-youpi-primary text-white", "rtl:-scale-x-100")}
                aria-hidden="true"
              />
            ) : (
              <BsArrowsExpandVertical
                className={clsx("w-8 h-8 p-1 rounded shadow-lg bg-youpi-primary text-white", "rtl:-scale-x-100")}
                aria-hidden="true"
              />
            )}
          </button>
        </div>

        <SidebarMenuItem
          id="rooms"
          Icon={LuGamepad2}
          ariaLabel={t({ message: "Rooms" })}
          isExpanded={isExpanded}
          href={ROUTE_TOWERS.PATH}
        >
          <Trans>Rooms</Trans>
        </SidebarMenuItem>
      </nav>

      <hr className="w-full border-t border-t-slate-600" />

      <nav className="flex-1 flex flex-col items-center w-full" aria-label={t({ message: "Joined games" })}>
        {gameMenuItems?.length > 0 && (
          <SidebarMenuItem
            id="towers"
            Icon={TbTower}
            ariaLabel="Towers"
            isExpanded={isExpanded}
            menuItems={gameMenuItems}
            onClick={() => setIsExpanded(true)}
          >
            Towers
          </SidebarMenuItem>
        )}
      </nav>
    </aside>
  );
}
