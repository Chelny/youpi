import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { ProfanityFilter } from "db/enums";
import CreateTableModal from "@/components/game/room/CreateTableModal";
import GameOptionsModal from "@/components/game/room/GameOptionsModal";
import Button from "@/components/ui/Button";
import { RATING_DIAMOND, RATING_GOLD, RATING_MASTER, RATING_PLATINUM, RATING_SILVER } from "@/constants/game";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useGame } from "@/context/GameContext";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";

type RoomSidebarProps = {
  roomId: string
  isSocialRoom: boolean
  avatarId: string
  profanityFilter: ProfanityFilter
  onSetProfanityFilter: (filter: ProfanityFilter) => void
};

export function RoomSidebar({
  roomId,
  isSocialRoom,
  avatarId,
  profanityFilter,
  onSetProfanityFilter,
}: RoomSidebarProps): ReactNode {
  const router = useRouter();
  const { socketRef } = useSocket();
  const { openModal } = useModal();
  const { removeJoinedRoom } = useGame();

  const handlePlayNow = (): void => {
    socketRef.current?.emit(
      ClientToServerEvents.TABLE_PLAY_NOW,
      { roomId },
      (response: SocketCallback<{ tableId: string }>): void => {
        if (response.success) {
          router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}&table=${response.data?.tableId}`);
        }
      },
    );
  };

  const handleOpenCreateTableModal = (): void => {
    openModal(CreateTableModal, {
      roomId,
      isSocialRoom,
      onCreateTableSuccess: (tableId: string): void => {
        router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}&table=${tableId}`);
      },
    });
  };

  const handleOpenOptionsModal = () => {
    openModal(GameOptionsModal, {
      avatarId,
      profanityFilter,
      onSetProfanityFilter: (value: ProfanityFilter) => onSetProfanityFilter(value),
    });
  };

  const handleExitRoom = (): void => {
    socketRef.current?.emit(ClientToServerEvents.ROOM_LEAVE, { roomId }, (response: SocketCallback) => {
      if (response.success) {
        removeJoinedRoom(roomId);
        router.push(ROUTE_TOWERS.PATH);
      }
    });
  };

  return (
    <div
      className={clsx(
        "[grid-area:sidebar] flex flex-col justify-between p-2 bg-gray-200",
        "dark:bg-dark-game-sidebar-background",
      )}
    >
      <div className="mb-4">
        <Button className="w-full py-2 mb-2" onClick={handlePlayNow}>
          <Trans>Play Now</Trans>
        </Button>
        <Button className="w-full py-2 mb-2" onClick={handleOpenCreateTableModal}>
          <Trans>Create Table</Trans>
        </Button>
      </div>
      <div className="mt-4">
        {!isSocialRoom && (
          <>
            <div>
              <span className="p-1 rounded-tl-sm rounded-tr-sm bg-sky-700 text-white text-sm">
                <Trans>Ratings</Trans>
              </span>
            </div>
            <div
              className={clsx(
                "flex flex-col gap-4 p-2 bg-white text-gray-600 mb-4",
                "dark:border-dark-card-border dark:bg-dark-card-background dark:text-gray-200",
              )}
            >
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-400"></div>
                <div>{RATING_MASTER}+</div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-400"></div>
                <div>
                  {RATING_DIAMOND}-{RATING_MASTER - 1}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-purple-400"></div>
                <div>
                  {RATING_PLATINUM}-{RATING_DIAMOND - 1}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-cyan-600"></div>
                <div>
                  {RATING_GOLD}-{RATING_PLATINUM - 1}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-600"></div>
                <div>
                  {RATING_SILVER}-{RATING_GOLD - 1}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-gray-400"></div>
                <div>
                  <Trans>provisional</Trans>
                </div>
              </div>
            </div>
          </>
        )}
        <Button className="w-full py-2 mb-2" onClick={handleOpenOptionsModal}>
          <Trans>Options</Trans>
        </Button>
        <Button className="w-full py-2 mb-2" onClick={handleExitRoom}>
          <Trans>Exit Room</Trans>
        </Button>
      </div>
    </div>
  );
}
