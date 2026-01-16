import { KeyboardEvent, ReactNode, useRef } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx/lite";
import { ProfanityFilter } from "@/app/generated/prisma/enums";
import ChatSkeleton from "@/components/skeleton/ChatSkeleton";
import PlayersListSkeleton from "@/components/skeleton/PlayersListSkeleton";
import ServerMessageSkeleton from "@/components/skeleton/ServerMessageSkeleton";
import { InputImperativeHandle } from "@/components/ui/Input";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { RoomChatMessagePlainObject } from "@/server/towers/classes/RoomChatMessage";
import { RoomPlayerPlainObject } from "@/server/towers/classes/RoomPlayer";
import { TableChatMessagePlainObject } from "@/server/towers/classes/TableChatMessage";
import { TablePlayerPlainObject } from "@/server/towers/classes/TablePlayer";

const ServerMessage = dynamic(() => import("@/components/game/ServerMessage"), {
  ssr: false,
  loading: () => <ServerMessageSkeleton />,
});

const Chat = dynamic(() => import("@/components/game/Chat"), {
  loading: () => <ChatSkeleton />,
});

const PlayersList = dynamic(() => import("@/components/game/PlayersList"), {
  loading: () => <PlayersListSkeleton isTableNumberVisible />,
});

type PlayerListItem = RoomPlayerPlainObject | TablePlayerPlainObject;
type ChatMessagePlainObject = RoomChatMessagePlainObject | TableChatMessagePlainObject;

type ChatAndPlayersListProps = {
  roomId: string
  tableId?: string
  isSocialRoom: boolean
  chatMessages: ChatMessagePlainObject[]
  profanityFilter?: ProfanityFilter
  players: PlayerListItem[]
};

export function ChatAndPlayersList({
  roomId,
  tableId,
  isSocialRoom,
  chatMessages,
  profanityFilter,
  players,
}: ChatAndPlayersListProps): ReactNode {
  const { socketRef, isConnected } = useSocket();
  const messageInputRef = useRef<InputImperativeHandle>(null);

  const handleSendMessage = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter" && messageInputRef.current?.value) {
      const text: string = messageInputRef.current.value.trim();

      if (text !== "") {
        socketRef.current?.emit(
          tableId ? ClientToServerEvents.TABLE_MESSAGE_SEND : ClientToServerEvents.ROOM_MESSAGE_SEND,
          {
            ...(tableId ? { tableId } : { roomId }),
            text,
          },
          (response: SocketCallback) => {
            if (response.success) {
              messageInputRef.current?.clear();
            }
          },
        );
      }
    }
  };

  return (
    <div className="[grid-area:chat] flex gap-2">
      <div
        className={clsx(
          "overflow-hidden flex-1 flex flex-col gap-1 border border-gray-200 bg-white",
          "dark:border-dark-game-content-border dark:bg-dark-game-chat-background",
        )}
      >
        <ServerMessage />

        {/* Chat */}
        <div className="overflow-hidden flex flex-col gap-1 h-full px-2">
          <Chat
            chatMessages={chatMessages}
            messageInputRef={messageInputRef}
            isMessageInputDisabled={!isConnected}
            profanityFilter={profanityFilter}
            onSendMessage={handleSendMessage}
          />
        </div>
      </div>

      <div className="w-[385px]">
        <PlayersList
          roomId={roomId}
          players={players}
          isRatingsVisible={!isSocialRoom}
          isTableNumberVisible={!tableId}
        />
      </div>
    </div>
  );
}
