"use client";

import { KeyboardEvent, ReactNode, Ref, useEffect, useMemo, useRef } from "react";
import { useLingui } from "@lingui/react/macro";
import { ProfanityFilter, TableChatMessageType } from "db/browser";
import { TableType } from "db/browser";
import Input, { InputImperativeHandle } from "@/components/ui/Input";
import { APP_CONFIG } from "@/constants/app";
import { FKey, fKeyMessages } from "@/constants/f-key-messages";
import { CHAT_MESSSAGE_MAX_LENGTH } from "@/constants/game";
import { useSocket } from "@/context/SocketContext";
import { filterProfanity } from "@/server/profanity/filter";
import { RoomChatMessagePlainObject } from "@/server/towers/modules/room-chat-message/room-chat-message.entity";
import {
  TableChatMessagePlainObject,
  TableChatMessageVariables,
} from "@/server/towers/modules/table-chat-message/table-chat-message.entity";

type ChatMessage = RoomChatMessagePlainObject | TableChatMessagePlainObject;

type ChatProps = {
  chatMessages: ChatMessage[]
  messageInputRef?: Ref<InputImperativeHandle>
  isMessageInputDisabled: boolean
  profanityFilter?: ProfanityFilter
  onSendMessage: (event: KeyboardEvent<HTMLInputElement>) => void
};

export default function Chat({
  chatMessages,
  messageInputRef,
  isMessageInputDisabled,
  profanityFilter,
  onSendMessage,
}: ChatProps): ReactNode {
  const { session } = useSocket();
  const { i18n, t } = useLingui();
  const chatEndRef = useRef<HTMLDivElement>(null);

  const getTableAutomatedChatMessage = (
    type: TableChatMessageType,
    textVariables: TableChatMessageVariables | null,
  ): string => {
    const plainChar: string | undefined = textVariables?.plainChar;
    const cipherChar: string | undefined = textVariables?.cipherChar;
    const fKey: FKey | undefined = textVariables?.fKey;
    const oldRating: number | undefined = textVariables?.oldRating;
    const newRating: number | undefined = textVariables?.newRating;
    const heroCode: string | undefined = textVariables?.heroCode;
    const tableHostUsername: string | undefined = textVariables?.tableHostUsername;
    const tableType: TableType | undefined = textVariables?.tableType;
    const username: string | null | undefined = textVariables?.username;
    const appName: string = APP_CONFIG.NAME;
    let message: string = "";

    switch (type) {
      case TableChatMessageType.CIPHER_KEY:
        message = i18n._("Cipher key: {plainChar} => {cipherChar}", { plainChar, cipherChar });
        break;

      case TableChatMessageType.F_KEY:
        if (typeof fKey !== "undefined") {
          message = i18n._(fKeyMessages[fKey]);
          return i18n._("{username}: {message}", { username, message });
        }
        break;

      case TableChatMessageType.GAME_RATING:
        message = i18n._("{username}’s old rating: {oldRating}; new rating: {newRating}", {
          username,
          oldRating,
          newRating,
        });
        break;

      case TableChatMessageType.HERO_CODE:
        if (heroCode) return heroCode;
        break;

      case TableChatMessageType.HERO_MESSAGE:
        message = i18n._("{username} is a hero of {appName}!", { username, appName });
        break;

      case TableChatMessageType.TABLE_HOST:
        message = i18n._(
          "You are the host of the table. This gives you the power to invite to [or boot people from] your table. You may also limit other player’s access to your table by selecting its \"Table Type\".",
        );
        break;

      case TableChatMessageType.TABLE_TYPE:
        switch (tableType) {
          case TableType.PROTECTED:
            message = i18n._("Only people you have invited may play now.");
            break;
          case TableType.PRIVATE:
            message = i18n._("Only people you have invited may play or watch your table now.");
            break;
          default:
            message = i18n._("Anyone may play or watch your table now.");
        }
        break;

      case TableChatMessageType.USER_BOOTED_FROM_TABLE:
        message = i18n._("{tableHostUsername} has booted {username} from the table.", { tableHostUsername, username });
        break;

      case TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITEE:
        message = i18n._("You have been granted access to play by the host.");
        break;

      case TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITER:
        message = i18n._("You granted {username} access to play.", { username });
        break;

      case TableChatMessageType.USER_JOINED_TABLE:
        message = i18n._("{username} has joined the table.", { username });
        break;

      case TableChatMessageType.USER_INVITED_TO_TABLE:
        message = i18n._("{username} has accepted the invitation to the table.", { username });
        break;

      case TableChatMessageType.USER_LEFT_TABLE:
        message = i18n._("{username} has left the table.", { username });
        break;

      default:
        break;
    }

    return `*** ${message}`;
  };

  const translatedMessages = useMemo(() => {
    if (!chatMessages) return;

    return chatMessages
      .filter((message: ChatMessage) => {
        const visibleToUserId: string | null = (message as TableChatMessagePlainObject).visibleToUserId;
        return !visibleToUserId || visibleToUserId === session?.user.id;
      })
      .map((message: ChatMessage) => {
        const textVariables: TableChatMessageVariables | null = (message as TableChatMessagePlainObject).textVariables;
        const translatedMessage: string | null =
          message.text ?? getTableAutomatedChatMessage((message as TableChatMessagePlainObject).type, textVariables);

        return {
          ...message,
          text: filterProfanity(translatedMessage, profanityFilter),
        };
      });
  }, [chatMessages, profanityFilter, session?.user.id]);

  const scrollToBottom = (): void => {
    chatEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  return (
    <div className="overflow-hidden flex flex-col gap-1 h-full">
      <Input
        ref={messageInputRef}
        id="chat"
        type="text"
        className="w-full p-2 -mb-4 border border-gray-200"
        placeholder={t({ message: "Write something..." })}
        maxLength={CHAT_MESSSAGE_MAX_LENGTH}
        disabled={isMessageInputDisabled}
        onKeyDown={onSendMessage}
      />
      <div className="overflow-y-auto flex-1 my-1">
        {translatedMessages?.map((message: ChatMessage) => (
          <div key={message.id} className="flex">
            {!("type" in message) || (message as TableChatMessagePlainObject).type === TableChatMessageType.CHAT ? (
              <>
                <span className="order-1">{message.player.user?.username}:&nbsp;</span>
                <span className="order-2">{message.text}</span>
              </>
            ) : (
              <span>{message.text}</span>
            )}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
    </div>
  );
}
