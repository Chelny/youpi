import { InstantMessageType } from "db/browser";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import { ConversationParticipant } from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import { InstantMessage } from "@/server/youpi/modules/instant-message/instant-message.entity";
import { User } from "@/server/youpi/modules/user/user.entity";

const userChelny = new User({ id: "ulksi62tgp6rbeou94jyazsp", username: "chelny", userSettings: null });
const userBob = new User({ id: "u2", username: "Bob", userSettings: null });
const userCharlie = new User({ id: "u3", username: "Charlie", userSettings: null });

const participantChelny = new ConversationParticipant({ id: "cp1", conversationId: "c1", user: userChelny });
const participantBob = new ConversationParticipant({ id: "cp3", conversationId: "c1", user: userBob });
const participantCharlie = new ConversationParticipant({ id: "cp4", conversationId: "c2", user: userCharlie });

participantChelny.readAt = new Date("2025-12-01T00:00:00Z");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeMessage = (props: any, createdAt: string) => {
  const msg: InstantMessage = new InstantMessage(props)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(msg as any).createdAt = new Date(createdAt);
  msg.updatedAt = new Date(createdAt);
  return msg;
};

const messagesC1 = [
  makeMessage(
    {
      id: "im1",
      conversationId: "c1",
      user: userChelny,
      text: "Hey Bob, want to join a game?",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-11-28T10:00:00Z",
  ),
  makeMessage(
    {
      id: "im2",
      conversationId: "c1",
      user: userBob,
      text: "Sure, Chelny! Let's go.",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-11-28T10:05:00Z",
  ),
  makeMessage(
    {
      id: "im3",
      conversationId: "c1",
      user: userBob,
      text: "Where you at?",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-11-30T12:00:00Z",
  ),
  makeMessage(
    {
      id: "im4",
      conversationId: "c1",
      user: userChelny,
      text: "Hold on a sec",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-11-30T12:10:00Z",
  ),
  makeMessage(
    {
      id: "im5",
      conversationId: "c1",
      user: userBob,
      text: "Are you in",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-12-02T09:00:00Z",
  ),
  makeMessage(
    {
      id: "im6",
      conversationId: "c1",
      user: userBob,
      text: "Hello????",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-12-02T09:02:00Z",
  ),
];

const messagesC2 = [
  makeMessage(
    {
      id: "im7",
      conversationId: "c2",
      user: userCharlie,
      text: "Anyone up for a quick match?",
      type: InstantMessageType.CHAT,
      textVariables: null,
      visibleToUserId: null,
    },
    "2025-12-03T15:00:00Z",
  ),
];

export const mockConversations: Conversation[] = [
  new Conversation({
    id: "c1",
    participants: [participantChelny, participantBob],
    messages: messagesC1,
  }),
  new Conversation({
    id: "c2",
    participants: [participantChelny, participantCharlie],
    messages: messagesC2,
  }),
];

export const mockConversationsPlainObjects = mockConversations.map((c) => c.toPlainObject());
