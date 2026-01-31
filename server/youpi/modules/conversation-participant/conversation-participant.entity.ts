import { User, UserPlainObject } from "@/server/youpi/modules/user/user.entity";

export interface ConversationParticipantProps {
  id: string
  conversationId: string
  user: User
}

export interface ConversationParticipantPlainObject {
  readonly id: string
  readonly conversationId: string
  readonly userId: string
  readonly user: UserPlainObject
  readonly readAt: string | null
  readonly mutedAt: string | null
  readonly removedAt: string | null
}

export class ConversationParticipant {
  public readonly id: string;
  public readonly conversationId: string;
  public userId: string;
  private _user: User;
  public readAt: Date | null = null;
  public mutedAt: Date | null = null;
  public removedAt: Date | null = null;

  constructor(props: ConversationParticipantProps) {
    this.id = props.id;
    this.conversationId = props.conversationId;
    this.userId = props.user.id;
    this._user = props.user;
  }

  public get user(): User {
    return this._user;
  }

  public set user(user: User) {
    this._user = user;
    this.userId = user.id;
  }

  public markAsRead(): void {
    this.readAt = new Date();
  }

  public muteConversation(): void {
    this.mutedAt = new Date();
  }

  public unmuteConversation(): void {
    this.mutedAt = null;
  }

  public removeConversation(): void {
    this.removedAt = new Date();
  }

  public restoreConversation(): void {
    this.removedAt = null;
  }

  public toPlainObject(): ConversationParticipantPlainObject {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      user: this.user.toPlainObject(),
      readAt: this.readAt?.toISOString() ?? null,
      mutedAt: this.mutedAt?.toISOString() ?? null,
      removedAt: this.removedAt?.toISOString() ?? null,
    };
  }
}
