import { JsonValue } from "@prisma/client/runtime/client";
import { InstantMessageType } from "db/client";
import { User, UserPlainObject } from "@/server/youpi/modules/user/user.entity";

export interface InstantMessageProps {
  id: string
  conversationId: string
  user: User
  text: string | null
  type: InstantMessageType
  textVariables: JsonValue | null
  visibleToUserId: string | null
}

export interface InstantMessageVariables {
  username?: string
}

export interface InstantMessagePlainObject {
  readonly id: string
  readonly conversationId: string
  readonly userId: string
  readonly user: UserPlainObject
  readonly text: string | null
  readonly type: InstantMessageType
  readonly textVariables: JsonValue | null
  readonly visibleToUserId: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export class InstantMessage {
  public readonly id: string;
  public readonly conversationId: string;
  public userId: string;
  private _user: User;
  public text: string | null;
  public type: InstantMessageType;
  public textVariables: JsonValue | null;
  public visibleToUserId: string | null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: InstantMessageProps) {
    this.id = props.id;
    this.conversationId = props.conversationId;
    this.userId = props.user.id;
    this._user = props.user;
    this.text = props.text;
    this.type = props.type;
    this.textVariables = props.textVariables;
    this.visibleToUserId = props.visibleToUserId;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public get user(): User {
    return this._user;
  }

  public set user(user: User) {
    this._user = user;
    this.userId = user.id;
  }

  public toPlainObject(): InstantMessagePlainObject {
    return {
      id: this.id,
      conversationId: this.conversationId,
      userId: this.userId,
      user: this.user.toPlainObject(),
      text: this.text,
      type: this.type,
      textVariables: this.textVariables,
      visibleToUserId: this.visibleToUserId,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
