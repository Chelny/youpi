"use client";

import { ReactNode, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useLingui } from "@lingui/react/macro";
import { Socket } from "socket.io-client";
import PlayersListSkeleton from "@/components/skeleton/PlayersListSkeleton";
import Modal from "@/components/ui/Modal";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";

const PlayersList = dynamic(() => import("@/components/game/PlayersList"), {
  loading: () => <PlayersListSkeleton />,
});

type TableBootUserModalProps = {
  roomId: string
  tableId: string
  hostId?: string
  isRatingsVisible?: boolean
  onCancel: () => void
};

export default function TableBootUserModal({
  roomId,
  tableId,
  hostId,
  isRatingsVisible,
  onCancel,
}: TableBootUserModalProps): ReactNode {
  const { socketRef, isConnected } = useSocket();
  const { t } = useLingui();
  const [playersToBoot, setPlayersToBoot] = useState<TablePlayerPlainObject[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const handleUpdatePlayersList = (): void => {
      socket.emit(
        ClientToServerEvents.TABLE_PLAYERS_TO_BOOT,
        { tableId },
        (response: SocketCallback<TablePlayerPlainObject[]>) => {
          if (response.success && response.data) {
            setPlayersToBoot(response.data);
          }
        },
      );
    };

    const emitInitialData = (): void => {
      handleUpdatePlayersList();
    };

    const attachListeners = (): void => {
      socket.on(ServerToClientEvents.TABLE_PLAYER_JOINED, handleUpdatePlayersList);
      socket.on(ServerToClientEvents.TABLE_PLAYER_LEFT, handleUpdatePlayersList);
    };

    const detachListeners = (): void => {
      socket.off(ServerToClientEvents.TABLE_PLAYER_JOINED, handleUpdatePlayersList);
      socket.off(ServerToClientEvents.TABLE_PLAYER_LEFT, handleUpdatePlayersList);
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
  }, [isConnected, tableId]);

  const handleSelectedPlayer = (): void => {
    socketRef.current?.emit(
      ClientToServerEvents.TABLE_BOOT_USER,
      { tableId, hostId, playerToBootId: selectedPlayerId },
      (response: SocketCallback<void>) => {
        if (response.success) {
          onCancel?.();
        }
      },
    );
  };

  return (
    <Modal
      title={t({ message: "Boot User" })}
      confirmText={t({ message: "Boot" })}
      isConfirmButtonDisabled={playersToBoot?.length === 0}
      dataTestId="table-boot-user"
      onConfirm={handleSelectedPlayer}
      onCancel={onCancel}
    >
      <div className="overflow-y-auto h-52">
        <PlayersList
          roomId={roomId}
          players={playersToBoot}
          isRatingsVisible={isRatingsVisible}
          onSelectedPlayer={setSelectedPlayerId}
        />
      </div>
    </Modal>
  );
}
