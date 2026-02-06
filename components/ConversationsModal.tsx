"use client";

import { KeyboardEvent, MouseEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { JsonValue } from "@prisma/client/runtime/client";
import clsx from "clsx/lite";
import { format } from "date-fns";
import { InstantMessageType, TableChatMessageType } from "db/browser";
import { VscBellSlashDot } from "react-icons/vsc";
import { Socket } from "socket.io-client";
import Checkbox from "@/components/ui/Checkbox";
import { ContextMenu, ContextMenuSection } from "@/components/ui/ContextMenu";
import Input, { InputImperativeHandle } from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useConversation } from "@/context/ConversationContext";
import { useSocket } from "@/context/SocketContext";
import { useContextMenu } from "@/hooks/useContextMenu";
import { SocketCallback } from "@/interfaces/socket";
import { SocketListener } from "@/lib/socket/socket-listener";
import { ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipantPlainObject } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { InstantMessagePlainObject } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { getDateFnsLocale } from "@/translations/languages";
import { getUnreadConversationsCount } from "@/utils/conversations";

type ConversationsModalProps = {
  conversationId: string
  onClose: () => void
};

export default function ConversationsModal({ conversationId, onClose }: ConversationsModalProps): ReactNode {
  const { i18n, t } = useLingui();
  const { socketRef, isConnected, session } = useSocket();
  const {
    conversations,
    activeConversationId,
    loadConversations,
    openConversation,
    closeConversation,
    sendMessage,
    markConversationAsRead,
    muteConversation,
    unmuteConversation,
    removeConversation,
    applyConversationUpdate,
    applyConversationRemove,
  } = useConversation();
  const [otherParticipant, setOtherParticipant] = useState<ConversationParticipantPlainObject>();
  const [conversationTime, setConversationTime] = useState<string>();
  const messageInputRef = useRef<InputImperativeHandle>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const { menu, openMenu, closeMenu } = useContextMenu<ConversationPlainObject>(modalRef);

  const menuSections: ContextMenuSection<ConversationPlainObject>[] = useMemo(
    () => [
      {
        items: [
          {
            label: t({ message: "Mark this conversation as read" }),
            onClick: (conversation: ConversationPlainObject): void => {
              markConversationAsRead(conversation.id);
            },
          },
          {
            label: (conversation: ConversationPlainObject): string => {
              const conversationParticipant: ConversationParticipantPlainObject | undefined =
                conversation.participants.find(
                  (cp: ConversationParticipantPlainObject) => cp.userId === session?.user.id,
                );
              return conversationParticipant?.mutedAt
                ? t({ message: "Unmute this conversation" })
                : t({ message: "Mute this conversation" });
            },
            onClick: (conversation: ConversationPlainObject): void => {
              const conversationParticipant: ConversationParticipantPlainObject | undefined =
                conversation.participants.find(
                  (cp: ConversationParticipantPlainObject) => cp.userId === session?.user.id,
                );

              conversationParticipant?.mutedAt ? unmuteConversation(conversation.id) : muteConversation(conversation.id);
            },
          },
        ],
      },
      {
        items: [
          {
            label: t({ message: "Remove this conversation" }),
            onClick: (conversation: ConversationPlainObject): void => {
              removeConversation(conversation.id);
            },
          },
        ],
      },
    ],
    [session?.user.id],
  );

  const currentConversation = useMemo(() => {
    if (!activeConversationId) return undefined;
    return conversations.get(activeConversationId);
  }, [activeConversationId, conversations]);

  const translatedMessages = useMemo(() => {
    return currentConversation?.messages
      .filter((instantMessage: InstantMessagePlainObject) => {
        const visibleToUserId: string | null = instantMessage.visibleToUserId;
        return !visibleToUserId || visibleToUserId === session?.user.id;
      })
      .map((instantMessage: InstantMessagePlainObject) => {
        const translatedMessage: string =
          instantMessage.text ?? getInstantMessageAutomatedMessage(instantMessage.type, instantMessage.textVariables);

        return {
          ...instantMessage,
          text: translatedMessage,
        };
      });
  }, [currentConversation]);

  useEffect(() => {
    if (!currentConversation) return;

    const otherParticipant: ConversationParticipantPlainObject | undefined = currentConversation.participants.find(
      (cp: ConversationParticipantPlainObject) => cp.userId !== session?.user.id,
    );
    setOtherParticipant(otherParticipant);
    setConversationTime(
      format(currentConversation.createdAt, "EEE MMM dd HH:mm:ss", { locale: getDateFnsLocale(i18n.locale) }),
    );
    markConversationAsRead(currentConversation.id);
  }, [currentConversation]);

  useEffect(() => {
    if (!currentConversation) return;
    scrollToBottom();
  }, [currentConversation?.messages.length]);

  useEffect(() => {
    if (!activeConversationId) return;

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "visible") {
        markConversationAsRead(activeConversationId);
      }
    };

    const handleFocus = (): void => {
      markConversationAsRead(activeConversationId);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [activeConversationId]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const socketListener: SocketListener = new SocketListener(socket);

    const emitInitialData = (): void => {
      loadConversations();
      openConversation(conversationId);
    };

    const handleUpdateConversation = ({ conversation }: { conversation: ConversationPlainObject }): void => {
      applyConversationUpdate(conversation);
    };

    const handleRemoveConversation = ({ conversationId }: { conversationId: string }): void => {
      applyConversationRemove(conversationId);
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.CONVERSATION_MARK_AS_READ, handleUpdateConversation);
      socketListener.on(ServerToClientEvents.CONVERSATION_MUTED, handleUpdateConversation);
      socketListener.on(ServerToClientEvents.CONVERSATION_UNMUTED, handleUpdateConversation);
      socketListener.on(ServerToClientEvents.CONVERSATION_REMOVED, handleRemoveConversation);
      socketListener.on(ServerToClientEvents.CONVERSATION_RESTORED, handleUpdateConversation);
      socketListener.on(ServerToClientEvents.CONVERSATION_MESSAGE_SENT, handleUpdateConversation);
    };

    const onConnect = (): void => {
      attachListeners();
      emitInitialData();
    };

    if (socket.connected) {
      onConnect();
    } else {
      socketListener.on("connect", onConnect);
    }

    return () => {
      socketListener.dispose();
    };
  }, [isConnected, session?.user.id]);

  const getLastMessageSnippet = (conversation: ConversationPlainObject): string => {
    const lastMessage: InstantMessagePlainObject = conversation.messages[conversation.messages.length - 1];
    if (!lastMessage) return "";
    return `${lastMessage.user.username}: ${lastMessage.text ?? lastMessage.type}`;
  };

  const handleContextMenu = (event: MouseEvent, conversation: ConversationPlainObject): void => {
    event.preventDefault();
    openMenu(event, conversation);
  };

  const getInstantMessageAutomatedMessage = (type: InstantMessageType, textVariables: JsonValue | null): string => {
    // @ts-ignore
    const { username } = textVariables;
    let message: string = "";

    switch (type) {
      case InstantMessageType.USER_ONLINE:
        message = i18n._("{username} is online.", { username });
        break;

      case InstantMessageType.USER_OFFLINE:
        message = i18n._("{username} is offline.", { username });
        break;

      default:
        break;
    }

    return `*** ${message}`;
  };

  const scrollToBottom = (): void => {
    conversationEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  };

  const handleSendMessage = async (): Promise<void> => {
    const text: string | undefined = messageInputRef.current?.value?.trim();
    if (!text || !activeConversationId) return;

    sendMessage(
      {
        conversationId: activeConversationId,
        message: text,
      },
      (response: SocketCallback<string>) => {
        if (response.success) {
          messageInputRef.current?.clear();
        }
      },
    );
  };

  const handleCloseModal = (): void => {
    closeConversation();
    onClose();
  };

  const renderContextMenu = (): ReactNode => {
    return (
      <ContextMenu<ConversationPlainObject>
        menu={menu}
        sections={menuSections}
        container={modalRef.current}
        onCloseMenu={closeMenu}
      />
    );
  };

  return (
    <Modal
      ref={modalRef}
      title={
        activeConversationId
          ? i18n._("Instant message with {username} started {time}", {
              username: otherParticipant?.user?.username,
              time: conversationTime,
            })
          : t({ message: "Conversations" })
      }
      customDialogSize="w-[992px] h-[600px]"
      cancelText={t({ message: "Close" })}
      dataTestId={"conversations"}
      onCancel={handleCloseModal}
      onClose={handleCloseModal}
    >
      <div className="flex flex-col overflow-hidden w-full h-full" onClick={closeMenu}>
        <div
          className={clsx(
            "flex overflow-hidden w-full h-full divide-x divide-slate-600 bg-white",
            "dark:divide-dark-card-border dark:bg-dark-background",
          )}
        >
          <aside className="overflow-y-auto w-60">
            <ul className={clsx("divide-y divide-slate-600", "dark:divide-dark-card-border")}>
              {Array.from(conversations.values()).map((conversation: ConversationPlainObject) => {
                const currentParticipant: ConversationParticipantPlainObject | undefined =
                  conversation.participants.find(
                    (cp: ConversationParticipantPlainObject) => cp.userId === session?.user.id,
                  );
                const otherParticipant: ConversationParticipantPlainObject | undefined = conversation.participants.find(
                  (cp: ConversationParticipantPlainObject) => cp.userId !== session?.user.id,
                );
                const otherParticipantUsername: string | undefined = otherParticipant?.user.username;
                const snippet: string = getLastMessageSnippet(conversation);
                const unreadCount: number = getUnreadConversationsCount(conversation, session?.user.id);
                const isCurrentConversation: boolean = activeConversationId === conversation.id;
                const isWindowActive: boolean = document.visibilityState === "visible" && document.hasFocus();
                const isShowBadge: boolean = unreadCount > 0 && (!isCurrentConversation || !isWindowActive);

                return (
                  <li
                    key={conversation.id}
                    className={clsx(
                      "flex flex-col gap-2 w-full p-2 cursor-pointer",
                      activeConversationId === conversation.id && "bg-slate-100 dark:bg-slate-700",
                    )}
                    onClick={() => openConversation(conversation.id)}
                    onContextMenu={(event: MouseEvent) => handleContextMenu(event, conversation)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium truncate">{otherParticipantUsername}</span>
                      {currentParticipant?.mutedAt ? (
                        <span className="inline-flex items-center justify-center px-1.5 py-1 ms-2 text-gray-400 font-bold">
                          <VscBellSlashDot />
                        </span>
                      ) : (
                        isShowBadge && (
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 ms-2 bg-red-600 text-white text-xs font-semibold rounded-full">
                            {unreadCount}
                          </span>
                        )
                      )}
                    </div>
                    <div
                      className={clsx(
                        "flex justify-between items-center gap-2 text-gray-500 text-sm",
                        "dark:text-dark-text-muted",
                      )}
                    >
                      <span className="truncate">{snippet}</span>
                      <span className={clsx("text-gray-400 text-xs text-right", "dark:text-dark-text-muted")}>
                        {format(conversation.messages[conversation.messages.length - 1].createdAt, "HH:mm", {
                          locale: getDateFnsLocale(i18n.locale),
                        })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex-1 flex flex-col p-2 -mb-2">
            {currentConversation ? (
              <div
                className={clsx("flex flex-col gap-4 h-full divide-y divide-slate-600", "dark:divide-dark-card-border")}
              >
                <div className="flex-1 overflow-y-auto pb-1">
                  {translatedMessages?.map((instantMessage: InstantMessagePlainObject) => {
                    const time: string = format(instantMessage.createdAt, "HH:mm", {
                      locale: getDateFnsLocale(i18n.locale),
                    });

                    return (
                      <div
                        key={instantMessage.id}
                        className={clsx(
                          "flex justify-between items-center gap-2 p-1",
                          "hover:bg-slate-50",
                          "dark:hover:bg-slate-700",
                        )}
                      >
                        <div className="flex flex-1">
                          {instantMessage.type === TableChatMessageType.CHAT && (
                            <span className="order-1">{instantMessage.user?.username}:&nbsp;</span>
                          )}
                          <span
                            className={clsx(
                              instantMessage.type === TableChatMessageType.CHAT
                                ? "order-2"
                                : "text-slate-500 dark:text-dark-text-muted",
                            )}
                          >
                            {instantMessage.text}
                          </span>
                        </div>

                        <span className={clsx("text-gray-400 text-xs", "dark:text-dark-text-muted")}>{time}</span>
                      </div>
                    );
                  })}
                  <div ref={conversationEndRef} />
                </div>
                <Input
                  ref={messageInputRef}
                  type="text"
                  id="instantMessage"
                  inlineButtonText={t({ message: "Send" })}
                  dataTestId="instant-message_input-text_message"
                  onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === "Enter") {
                      // Prevent submitting modal form
                      event.preventDefault();
                    }
                  }}
                  onInlineButtonClick={handleSendMessage}
                />
              </div>
            ) : (
              <div
                className={clsx("flex justify-center items-center h-full text-gray-500", "dark:text-dark-text-muted")}
              >
                {Array.from(conversations.values()).length > 0
                  ? t({ message: "Select a conversation" })
                  : t({ message: "No conversations" })}
              </div>
            )}
          </section>
        </div>

        <div className="flex items-center justify-between px-1 pt-2 -mb-4">
          <Checkbox
            id="friendsOnlyInstantMessages"
            label={t({ message: "Allow instant messages from my friends only." })}
            disabled
            dataTestId="instant-message_input-checkbox_friends-only-instant-messages"
          />
        </div>
      </div>

      {renderContextMenu()}
    </Modal>
  );
}
