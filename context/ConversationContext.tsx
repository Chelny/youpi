"use client";

import { Context, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { ServerToClientEvents } from "@/constants/socket/server-to-client";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { SocketListener } from "@/lib/socket/socket-listener";
import { ConversationPlainObject } from "@/server/youpi/modules/conversation/conversation.entity";

interface ConversationContextType {
  conversations: Map<string, ConversationPlainObject>
  unreadConversationsCount: number
  activeConversationId: string | null

  loadConversations: () => void
  openConversation: (conversationId: string) => void
  closeConversation: () => void

  // Emit
  getUnreadConversationsCount: () => void
  sendMessage: (
    data: { conversationId?: string; recipientId?: string; message: string },
    onAck?: (response: SocketCallback<string>) => void,
  ) => void
  markConversationAsRead: (conversationId: string) => void
  muteConversation: (conversationId: string) => void
  unmuteConversation: (conversationId: string) => void
  removeConversation: (conversationId: string) => void

  // State mutation
  applyConversationUpdate: (conversation: ConversationPlainObject) => void
  applyConversationRemove: (conversationId: string) => void
}

const ConversationContext: Context<ConversationContextType | undefined> = createContext<
  ConversationContextType | undefined
>(undefined);

export const ConversationProvider = ({ children }: { children: React.ReactNode }) => {
  const { socketRef, isConnected } = useSocket();
  const [conversations, setConversations] = useState<Map<string, ConversationPlainObject>>(
    new Map<string, ConversationPlainObject>(),
  );
  const [unreadConversationsCount, setUnreadConversationsCount] = useState<number>(0);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const conversationsRef = useRef(conversations);

  const loadConversations = useCallback((): void => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    socket.emit(ClientToServerEvents.CONVERSATIONS, {}, (response: SocketCallback<ConversationPlainObject[]>) => {
      const data: ConversationPlainObject[] | undefined = response.data;
      if (response.success && data) {
        setConversations(() => {
          const conversations: Map<string, ConversationPlainObject> = new Map<string, ConversationPlainObject>();
          for (const conversation of data) {
            conversations.set(conversation.id, conversation);
          }
          return conversations;
        });
      }
    });
  }, [isConnected]);

  const openConversation = useCallback(
    (conversationId: string): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      setActiveConversationId(conversationId);

      if (conversationsRef.current.has(conversationId)) return;

      socket.emit(
        ClientToServerEvents.CONVERSATION,
        { conversationId },
        (response: SocketCallback<ConversationPlainObject>) => {
          if (response.success && response.data) {
            applyConversationUpdate(response.data);
          }
        },
      );
    },
    [isConnected],
  );

  const closeConversation = useCallback((): void => {
    setActiveConversationId(null);
  }, []);

  const getUnreadConversationsCount = useCallback((): void => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    socket.emit(ClientToServerEvents.CONVERSATIONS_UNREAD, {}, (response: SocketCallback<number>) => {
      if (response.success && typeof response.data === "number") {
        setUnreadConversationsCount(response.data);
      }
    });
  }, [isConnected]);

  const sendMessage = useCallback(
    (
      data: { conversationId?: string; recipientId?: string; message: string },
      onAck?: (response: SocketCallback<string>) => void,
    ): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      socket.emit(ClientToServerEvents.CONVERSATION_MESSAGE_SEND, data, (response: SocketCallback<string>) => {
        onAck?.(response);
      });
    },
    [isConnected],
  );

  const markConversationAsRead = useCallback(
    (conversationId: string): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      socket.emit(ClientToServerEvents.CONVERSATION_MARK_AS_READ, { conversationId });
    },
    [isConnected],
  );

  const muteConversation = useCallback(
    (conversationId: string): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      socket.emit(ClientToServerEvents.CONVERSATION_MUTE, { conversationId });
    },
    [isConnected],
  );

  const unmuteConversation = useCallback(
    (conversationId: string): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      socket.emit(ClientToServerEvents.CONVERSATION_UNMUTE, { conversationId });
    },
    [isConnected],
  );

  const removeConversation = useCallback(
    (conversationId: string): void => {
      const socket: Socket | null = socketRef.current;
      if (!isConnected || !socket) return;

      socket.emit(ClientToServerEvents.CONVERSATION_REMOVE, { conversationId });
    },
    [isConnected],
  );

  const applyConversationUpdate = useCallback((conversation: ConversationPlainObject) => {
    setConversations((prev: Map<string, ConversationPlainObject>) => {
      const conversations: Map<string, ConversationPlainObject> = new Map<string, ConversationPlainObject>(prev);
      conversations.set(conversation.id, conversation);
      return conversations;
    });
  }, []);

  const applyConversationRemove = useCallback((conversationId: string) => {
    setConversations((prev: Map<string, ConversationPlainObject>) => {
      const conversations: Map<string, ConversationPlainObject> = new Map<string, ConversationPlainObject>(prev);
      conversations.delete(conversationId);
      return conversations;
    });

    setActiveConversationId((prev: string | null) => (prev === conversationId ? null : prev));
  }, []);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    const socket: Socket | null = socketRef.current;
    if (!isConnected || !socket) return;

    const socketListener: SocketListener = new SocketListener(socket);

    const emitInitialData = (): void => {
      getUnreadConversationsCount();
    };

    const handleUnreadUpdate = ({ unreadConversationsCount }: { unreadConversationsCount: number }): void => {
      setUnreadConversationsCount(unreadConversationsCount);
    };

    const attachListeners = (): void => {
      socketListener.on(ServerToClientEvents.CONVERSATIONS_UNREAD, handleUnreadUpdate);
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
  }, [isConnected]);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        unreadConversationsCount,
        activeConversationId,
        loadConversations,
        openConversation,
        closeConversation,
        getUnreadConversationsCount,
        sendMessage,
        markConversationAsRead,
        muteConversation,
        unmuteConversation,
        removeConversation,
        applyConversationUpdate,
        applyConversationRemove,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
};

export const useConversation = (): ConversationContextType => {
  const context: ConversationContextType | undefined = useContext(ConversationContext);
  if (!context) throw new Error("useConversation must be used inside ConversationProvider");
  return context;
};
