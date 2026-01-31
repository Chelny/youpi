import type {
  TableInvitation,
  TableInvitationPlainObject,
} from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TableBoot, TableBootPlainObject } from "@/server/towers/modules/table-boot/table-boot.entity";
import type { NotificationType } from "db/client";

export type NotificationCreateProps =
  | { playerId: string; roomId: string; type: NotificationType; tableInvitation: TableInvitation }
  | { playerId: string; roomId: string; type: NotificationType; bootedFromTable: TableBoot };

export type NotificationProps =
  | {
      id: string
      playerId: string
      roomId: string
      type: NotificationType
      tableInvitation: TableInvitation
    }
  | {
      id: string
      playerId: string
      roomId: string
      type: NotificationType
      bootedFromTable: TableBoot
    };

export interface NotificationPlainObject {
  readonly id: string
  readonly playerId: string
  readonly roomId: string
  readonly type: NotificationType
  readonly tableInvitationId: string | null
  readonly tableInvitation: TableInvitationPlainObject | null
  readonly bootedFromTableId: string | null
  readonly bootedFromTable: TableBootPlainObject | null
  readonly readAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export class Notification {
  public readonly id: string;
  public readonly playerId: string;
  public readonly roomId: string;
  public readonly type: NotificationType;
  public tableInvitationId: string | null = null;
  private _tableInvitation: TableInvitation | null = null;
  public bootedFromTableId: string | null = null;
  private _bootedFromTable: TableBoot | null = null;
  public readAt: Date | null = null;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: NotificationProps) {
    this.id = props.id;
    this.playerId = props.playerId;
    this.roomId = props.roomId;
    this.type = props.type;

    if ("tableInvitation" in props) {
      this.tableInvitationId = props.tableInvitation.id;
      this._tableInvitation = props.tableInvitation;
    } else if ("bootedFromTable" in props) {
      this.bootedFromTableId = props.bootedFromTable.id;
      this._bootedFromTable = props.bootedFromTable;
    }

    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public get tableInvitation(): TableInvitation | null {
    return this._tableInvitation;
  }

  public set tableInvitation(tableInvitation: TableInvitation | null) {
    this._tableInvitation = tableInvitation;
    this.tableInvitationId = tableInvitation?.id ?? null;
  }

  public get bootedFromTable(): TableBoot | null {
    return this._bootedFromTable;
  }

  public set bootedFromTable(bootedFromTable: TableBoot | null) {
    this._bootedFromTable = bootedFromTable;
    this.bootedFromTableId = bootedFromTable?.id ?? null;
  }

  public async markAsRead(): Promise<void> {
    this.readAt = new Date();
  }

  public toPlainObject(): NotificationPlainObject {
    return {
      id: this.id,
      playerId: this.playerId,
      roomId: this.roomId,
      type: this.type,
      tableInvitationId: this.tableInvitationId,
      tableInvitation: this.tableInvitation?.toPlainObject() ?? null,
      bootedFromTableId: this.bootedFromTableId,
      bootedFromTable: this.bootedFromTable?.toPlainObject() ?? null,
      readAt: this.readAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
