import { createId } from "@paralleldrive/cuid2";
import { Conversation } from "@/server/youpi/modules/conversation/conversation.entity";
import {
  ConversationParticipant,
  ConversationParticipantProps,
} from "@/server/youpi/modules/conversation-participant/conversation-participant.entity";

export class ConversationParticipantManager {
  private static conversationParticipants: Map<string, ConversationParticipant> = new Map<
    string,
    ConversationParticipant
  >();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): ConversationParticipant | undefined {
    return this.conversationParticipants.get(id);
  }

  public static all(): ConversationParticipant[] {
    return [...this.conversationParticipants.values()];
  }

  public static create(props: Omit<ConversationParticipantProps, "id">): ConversationParticipant {
    const conversationParticipant: ConversationParticipant = new ConversationParticipant({ id: createId(), ...props });
    this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
    return conversationParticipant;
  }

  public static update(props: ConversationParticipantProps): void {
    const conversationParticipant: ConversationParticipant | undefined = this.get(props.id);
    if (!conversationParticipant) return;
    conversationParticipant.user = props.user;
  }

  public static delete(id: string): void {
    this.conversationParticipants.delete(id);
  }

  // ---------- Conversation Participant Actions ------------------------------

  public static getParticipantByConversationIdAndUserId(
    conversationId: string,
    userId: string,
  ): ConversationParticipant | undefined {
    return this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId === userId,
    );
  }

  public static getOtherParticipant(conversationId: string, userId: string): ConversationParticipant | undefined {
    return this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId !== userId,
    );
  }

  public static markConversationAsRead(conversationId: string, userId: string): void {
    const conversationParticipant: ConversationParticipant | undefined = this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId === userId,
    );
    if (!conversationParticipant) return undefined;

    conversationParticipant.markAsRead();
    this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
  }

  public static async muteConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant | undefined = this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId === userId,
    );
    if (!conversationParticipant) return undefined;

    if (!conversationParticipant.mutedAt) {
      conversationParticipant.muteConversation();
      this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async unmuteConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant = this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId === userId,
    );
    if (!conversationParticipant) return;

    if (conversationParticipant.mutedAt) {
      conversationParticipant.unmuteConversation();
      this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async removeConversationForUser(conversationId: string, userId: string): Promise<void> {
    const conversationParticipant: ConversationParticipant | undefined = this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversationId && cp.userId === userId,
    );
    if (!conversationParticipant) return undefined;

    if (!conversationParticipant.removedAt) {
      conversationParticipant.removeConversation();
      this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
    }
  }

  public static async restoreConversationForUser(conversation: Conversation, userId: string): Promise<void> {
    const conversationParticipant = this.all().find(
      (cp: ConversationParticipant) => cp.conversationId === conversation.id && cp.userId === userId,
    );
    if (!conversationParticipant) return;

    if (conversationParticipant.removedAt) {
      conversationParticipant.restoreConversation();
      this.conversationParticipants.set(conversationParticipant.id, conversationParticipant);
    }
  }
}
