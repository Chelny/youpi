import { BlockReason, RelationshipType } from "db/enums";
import { User, UserPlainObject } from "@/server/youpi/modules/user/user.entity";

export interface UserRelationshipProps {
  id: string
  sourceUser: User
  targetUser: User
  type?: RelationshipType
  blockReason?: BlockReason
  isMuted?: boolean
}

export interface UserRelationshipPlainObject {
  readonly id: string
  readonly sourceUserId: string
  readonly sourceUser: UserPlainObject
  readonly targetUserId: string
  readonly targetUser: UserPlainObject
  readonly type: RelationshipType
  readonly blockReason: BlockReason
  readonly isMuted: boolean
}

export class UserRelationship {
  public readonly id: string;
  public sourceUserId: string;
  private _sourceUser: User;
  public targetUserId: string;
  private _targetUser: User;
  public type: RelationshipType;
  public blockReason: BlockReason;
  public isMuted: boolean;

  constructor(props: UserRelationshipProps) {
    this.id = props.id;
    this.sourceUserId = props.sourceUser.id;
    this._sourceUser = props.sourceUser;
    this.targetUserId = props.targetUser.id;
    this._targetUser = props.targetUser;
    this.type = props.type ?? RelationshipType.NONE;
    this.blockReason = props.blockReason ?? BlockReason.NO_REASON;
    this.isMuted = props.isMuted ?? false;
  }

  public get sourceUser(): User {
    return this._sourceUser;
  }

  public set sourceUser(sourceUser: User) {
    this._sourceUser = sourceUser;
    this.sourceUserId = sourceUser.id;
  }

  public get targetUser(): User {
    return this._targetUser;
  }

  public set targetUser(targetUser: User) {
    this._targetUser = targetUser;
    this.targetUserId = targetUser.id;
  }

  public toPlainObject(): UserRelationshipPlainObject {
    return {
      id: this.id,
      sourceUserId: this.sourceUserId,
      sourceUser: this.sourceUser.toPlainObject(),
      targetUserId: this.targetUserId,
      targetUser: this.targetUser.toPlainObject(),
      type: this.type,
      blockReason: this.blockReason,
      isMuted: this.isMuted,
    };
  }
}
