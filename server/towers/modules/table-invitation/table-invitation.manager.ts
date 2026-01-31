import { createId } from "@paralleldrive/cuid2";
import { NotificationType, TableChatMessageType, TableInvitationStatus, TableType } from "db/client";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { Notification } from "@/server/towers/modules/notification/notification.entity";
import { NotificationManager } from "@/server/towers/modules/notification/notification.manager";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { TableChatMessage } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableChatMessageManager } from "@/server/towers/modules/table-chat-message/table-chat-message.manager";
import { TableInvitation, TableInvitationProps } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TablePlayerManager } from "@/server/towers/modules/table-player/table-player.manager";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";

export class TableInvitationManager {
  private static tableInvitations: Map<string, TableInvitation> = new Map<string, TableInvitation>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): TableInvitation | undefined {
    return this.tableInvitations.get(id);
  }

  public static all(): TableInvitation[] {
    return [...this.tableInvitations.values()];
  }

  public static create(props: Omit<TableInvitationProps, "id">): TableInvitation {
    const tableInvitation: TableInvitation = new TableInvitation({ id: createId(), ...props });
    this.tableInvitations.set(tableInvitation.id, tableInvitation);
    PlayerManager.updateLastActiveAt(props.inviterPlayer.id);
    return tableInvitation;
  }

  public static delete(id: string): void {
    this.tableInvitations.delete(id);
  }

  // ---------- Table Invitation Actions ------------------------------

  public static getInvitationsForPlayer(tableId: string, playerId: string): TableInvitation[] {
    return this.all().filter(
      (ti: TableInvitation) =>
        ti.tableId === tableId && (ti.inviterPlayerId === playerId || ti.inviteePlayerId === playerId),
    );
  }

  public static getSentInvitations(playerId: string): TableInvitation[] {
    return this.all().filter((ti: TableInvitation) => ti.inviterPlayerId === playerId);
  }

  public static getSentInvitationsByTableId(tableId: string, playerId: string): TableInvitation[] {
    return this.getSentInvitations(playerId).filter((ti: TableInvitation) => ti.tableId === tableId);
  }

  public static getReceivedInvitations(playerId: string): TableInvitation[] {
    return this.all().filter((ti: TableInvitation) => ti.inviteePlayerId === playerId);
  }

  public static getReceivedInvitationsByTableId(tableId: string, playerId: string): TableInvitation[] {
    return this.getReceivedInvitations(playerId).filter((ti: TableInvitation) => ti.tableId === tableId);
  }

  public static hasPendingInvitationForTable(tableId: string, playerId: string): boolean {
    return this.getReceivedInvitationsByTableId(tableId, playerId).some(
      (ti: TableInvitation) => ti.status === TableInvitationStatus.PENDING,
    );
  }

  public static hasAcceptedInvitationForTable(tableId: string, playerId: string): boolean {
    return this.getReceivedInvitationsByTableId(tableId, playerId).some(
      (ti: TableInvitation) => ti.status === TableInvitationStatus.ACCEPTED,
    );
  }

  public static deleteForTableAndPlayer(tableId: string, playerId: string): void {
    for (const invitation of this.tableInvitations.values()) {
      if (
        invitation.tableId === tableId &&
        (invitation.inviteePlayerId === playerId || invitation.inviterPlayerId === playerId)
      ) {
        this.delete(invitation.id);
        invitation.table.removeInvitation(invitation.id);
      }
    }
  }

  public static async accept(tableInvitationId: string): Promise<void> {
    const tableInvitation: TableInvitation | undefined = this.get(tableInvitationId);
    if (!tableInvitation) return;

    tableInvitation.status = TableInvitationStatus.ACCEPTED;
    PlayerManager.updateLastActiveAt(tableInvitation.inviterPlayer.id);

    if (
      (tableInvitation.table.tableType === TableType.PROTECTED ||
        tableInvitation.table.tableType === TableType.PRIVATE) &&
      TablePlayerManager.isInTable(tableInvitation.tableId, tableInvitation.inviteePlayerId)
    ) {
      // Auto-accept case: Existing seated player in protected/private tables
      const inviterTableChatMessage: TableChatMessage = await TableChatMessageManager.create({
        tableId: tableInvitation.table.id,
        player: tableInvitation.inviterPlayer,
        text: null,
        type: TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITER,
        textVariables: { username: tableInvitation.inviteePlayer.user.username },
        visibleToUserId: tableInvitation.inviterPlayerId,
      });

      tableInvitation.table.addChatMessage(inviterTableChatMessage);

      const inviteeTableChatMessage: TableChatMessage = await TableChatMessageManager.create({
        tableId: tableInvitation.table.id,
        player: tableInvitation.inviteePlayer,
        text: null,
        type: TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITEE,
        textVariables: null,
        visibleToUserId: tableInvitation.inviteePlayerId,
      });

      tableInvitation.table.addChatMessage(inviteeTableChatMessage);

      await publishRedisEvent(ServerInternalEvents.TABLE_INVITATION_ACCEPT, {
        userId: tableInvitation.inviteePlayerId,
        table: tableInvitation.table.toPlainObject(),
      });

      logger.debug(
        `${tableInvitation.inviteePlayer.user.username} has been granted access to play to table #${tableInvitation.table.tableNumber}.`,
      );
    } else {
      // Notify inviter privately that the invitee accepted their invitation
      const tableChatMessage: TableChatMessage = await TableChatMessageManager.create({
        tableId: tableInvitation.table.id,
        player: tableInvitation.inviterPlayer,
        text: null,
        type: TableChatMessageType.USER_INVITED_TO_TABLE,
        textVariables: { username: tableInvitation.inviteePlayer.user.username },
        visibleToUserId: tableInvitation.inviterPlayerId,
      });

      tableInvitation.table.addChatMessage(tableChatMessage);

      logger.debug(
        `${tableInvitation.inviteePlayer.user.username} accepted invitation to table #${tableInvitation.table.tableNumber}.`,
      );
    }
  }

  public static async decline(
    tableInvitationId: string,
    reason: string | null,
    isDeclineAll: boolean = false,
  ): Promise<void> {
    const tableInvitation: TableInvitation | undefined = this.get(tableInvitationId);
    if (!tableInvitation) return;

    tableInvitation.status = TableInvitationStatus.DECLINED;
    tableInvitation.declinedReason = reason;
    this.delete(tableInvitation.id);
    PlayerManager.updateLastActiveAt(tableInvitation.inviterPlayer.id);

    const notification: Notification = NotificationManager.create({
      playerId: tableInvitation.inviteePlayerId,
      roomId: tableInvitation.roomId,
      type: NotificationType.TABLE_INVITE_DECLINED,
      tableInvitation: tableInvitation,
    });

    await publishRedisEvent(ServerInternalEvents.TABLE_INVITATION_DECLINE, {
      userId: tableInvitation.inviterPlayerId,
      notification: notification.toPlainObject(),
    });

    logger.debug(
      `${tableInvitation.inviteePlayer?.user?.username} declined invitation to table #${tableInvitation.table?.tableNumber}. Reason: ${reason}`,
    );

    if (isDeclineAll) {
      this.declineAll(tableInvitation.inviteePlayer.user);
    }
  }

  public static async declineAll(user: User): Promise<void> {
    const pendingInvitations: TableInvitation[] = this.getReceivedInvitations(user.id).filter(
      (ti: TableInvitation) => ti.status === TableInvitationStatus.PENDING,
    );

    for (const pendingInvitation of pendingInvitations) {
      pendingInvitation.status = TableInvitationStatus.DECLINED;
      this.delete(pendingInvitation.id);
    }

    UserManager.blockTableInvitations(user.id);
  }
}
