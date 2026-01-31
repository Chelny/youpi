import {
  ConversationParticipant,
  ConversationParticipantPlainObject,
} from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";
import {
  InstantMessage,
  InstantMessagePlainObject,
} from "@/server/youpi/modules/instant-message/instant-message.entity";

export interface ConversationProps {
  id: string
  participants: ConversationParticipant[]
  messages: InstantMessage[]
}

export interface ConversationPlainObject {
  readonly id: string
  readonly participants: ConversationParticipantPlainObject[]
  readonly messages: InstantMessagePlainObject[]
  readonly createdAt: string
  readonly updatedAt: string
}

export class Conversation {
  public readonly id: string;
  public participants: ConversationParticipant[] = [];
  public messages: InstantMessage[] = [];
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: ConversationProps) {
    this.id = props.id;
    this.participants = props.participants;
    this.messages = props.messages;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public addParticipant(conversationParticipant: ConversationParticipant): void {
    this.participants.push(conversationParticipant);
  }

  public removeParticipant(id: string): void {
    this.participants = this.participants.filter((cp: ConversationParticipant) => cp.id !== id);
  }

  public addMessage(instantMessage: InstantMessage): void {
    this.messages.push(instantMessage);
  }

  public toPlainObject(): ConversationPlainObject {
    return {
      id: this.id,
      participants: this.participants.map((cp: ConversationParticipant) => cp.toPlainObject()),
      messages: this.messages.map((im: InstantMessage) => im.toPlainObject()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
