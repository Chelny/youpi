"use client";

import { ReactNode, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { NotificationType } from "db/browser";
import { Socket } from "socket.io-client";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useGame } from "@/context/GameContext";
import { useSocket } from "@/context/SocketContext";
import { SocketListener } from "@/lib/socket/socket-listener";
import { NotificationPlainObject } from "@/server/towers/modules/notification/notification.entity";

const Room = dynamic(() => import("@/components/game/room/Room"));
const Table = dynamic(() => import("@/components/game/table/Table"));

export default function TowersPageContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomId: string | null = searchParams.get("room");
  const tableId: string | null = searchParams.get("table");
  const { socketRef, isConnected } = useSocket();
  const { setActiveRoomId, removeJoinedTable, activeTableId, setActiveTableId } = useGame();

  useEffect(() => {
    setActiveRoomId(roomId);
  }, [roomId]);

  useEffect(() => {
    setActiveTableId(tableId);
  }, [tableId]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const socketListener: SocketListener = new SocketListener(socket);

    const handleUpdateNotification = ({ notification }: { notification: NotificationPlainObject }): void => {
      if (notification.type === NotificationType.TABLE_BOOTED && !!notification.bootedFromTable) {
        removeJoinedTable(notification.bootedFromTable.tableId);

        if (activeTableId === notification.bootedFromTable.tableId) {
          setActiveTableId(null);
          router.push(`${ROUTE_TOWERS.PATH}?room=${notification.bootedFromTable.table.roomId}`);
        }
      }
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.TABLE_BOOTED_NOTIFICATION, handleUpdateNotification);
    };

    const onConnect = (): void => {
      attachListeners();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socketListener.on("connect", onConnect);
    }

    return () => {
      socketListener.dispose();
    };
  }, [isConnected, activeTableId]);

  return <div className="relative h-full">{tableId ? <Table key={tableId} /> : <Room key={roomId} />}</div>;
}
