import { NotificationType, TableChatMessageType, TableInvitationStatus, TableType } from "db/client";
import { TowersTableInvitationCreateInput } from "db/models";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { logger } from "@/lib/logger";
import { publishRedisEvent } from "@/server/redis/publish";
import { Notification } from "@/server/towers/modules/notification/notification.entity";
import { NotificationManager } from "@/server/towers/modules/notification/notification.manager";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { TableChatMessage } from "@/server/towers/modules/table-chat-message/table-chat-message.entity";
import { TableChatMessageManager } from "@/server/towers/modules/table-chat-message/table-chat-message.manager";
import { TableInvitation } from "@/server/towers/modules/table-invitation/table-invitation.entity";
import { TableInvitationFactory } from "@/server/towers/modules/table-invitation/table-invitation.factory";
import { TableInvitationService } from "@/server/towers/modules/table-invitation/table-invitation.service";
import { User } from "@/server/youpi/modules/user/user.entity";
import { UserManager } from "@/server/youpi/modules/user/user.manager";
import { TowersTableInvitationWithRelations } from "@/types/prisma";

export class TableInvitationManager {
  private static cache: Map<string, TableInvitation> = new Map<string, TableInvitation>();

  public static async findAllByPlayerId(tableId: string, playerId: string): Promise<TableInvitation[]> {
    const dbTableInvitations: TowersTableInvitationWithRelations[] = await TableInvitationService.findAllByPlayerId(
      tableId,
      playerId,
    );
    return dbTableInvitations.map(TableInvitationFactory.createTableInvitation);
  }

  public static async findAllByInviterPlayerId(playerId: string): Promise<TableInvitation[]> {
    const dbTableInvitations: TowersTableInvitationWithRelations[] =
      await TableInvitationService.findAllByInviterPlayerId(playerId);
    return dbTableInvitations.map(TableInvitationFactory.createTableInvitation);
  }

  public static async findAllByInviteePlayerId(playerId: string): Promise<TableInvitation[]> {
    const dbTableInvitations: TowersTableInvitationWithRelations[] =
      await TableInvitationService.findAllByInviteePlayerId(playerId);
    return dbTableInvitations.map(TableInvitationFactory.createTableInvitation);
  }

  private static async findReceivedInvitationsByTableId(tableId: string, playerId: string): Promise<TableInvitation[]> {
    const tableInvitations: TableInvitation[] = await this.findAllByInviteePlayerId(playerId);
    return tableInvitations.filter((ti: TableInvitation) => ti.tableId === tableId);
  }

  public static async hasPendingInvitationForTable(tableId: string, playerId: string): Promise<boolean> {
    const tableInvitations: TableInvitation[] = await this.findReceivedInvitationsByTableId(tableId, playerId);
    return tableInvitations.some((ti: TableInvitation) => ti.status === TableInvitationStatus.PENDING);
  }

  public static async hasAcceptedInvitationForTable(tableId: string, playerId: string): Promise<boolean> {
    const tableInvitations: TableInvitation[] = await this.findReceivedInvitationsByTableId(tableId, playerId);
    return tableInvitations.some((ti: TableInvitation) => ti.status === TableInvitationStatus.ACCEPTED);
  }

  public static async create(props: TowersTableInvitationCreateInput): Promise<TableInvitation> {
    const dbTableInvitation: TowersTableInvitationWithRelations = await TableInvitationService.create(props);
    const tableInvitation: TableInvitation = TableInvitationFactory.createTableInvitation(dbTableInvitation);
    await PlayerManager.updateLastActiveAt(tableInvitation.inviterPlayerId);
    return tableInvitation;
  }

  public static async accept(tableInvitationId: string): Promise<void> {
    const dbTableInvitation: TowersTableInvitationWithRelations = await TableInvitationService.update(
      tableInvitationId,
      {
        status: TableInvitationStatus.ACCEPTED,
      },
    );

    await PlayerManager.updateLastActiveAt(dbTableInvitation.inviterPlayer.id);

    const tableInvitation: TableInvitation = TableInvitationFactory.createTableInvitation(dbTableInvitation);

    if (
      (tableInvitation.table.tableType === TableType.PROTECTED ||
        tableInvitation.table.tableType === TableType.PRIVATE) &&
      tableInvitation.table.isPlayerInTable(tableInvitation.inviteePlayerId)
    ) {
      // Auto-accept case: Existing seated player in protected/private tables
      const inviterTableChatMessage: TableChatMessage = await TableChatMessageManager.create({
        table: {
          connect: { id: tableInvitation.table.id },
        },
        player: {
          connect: { id: tableInvitation.inviterPlayerId },
        },
        text: null,
        type: TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITER,
        textVariables: { username: tableInvitation.inviteePlayer.user.username },
        visibleToUserId: tableInvitation.inviterPlayerId,
      });

      tableInvitation.table.addChatMessage(inviterTableChatMessage);

      const inviteeTableChatMessage: TableChatMessage = await TableChatMessageManager.create({
        table: {
          connect: { id: tableInvitation.table.id },
        },
        player: {
          connect: { id: tableInvitation.inviteePlayerId },
        },
        text: null,
        type: TableChatMessageType.USER_GRANTED_SEAT_ACCESS_INVITEE,
        textVariables: undefined,
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
        table: {
          connect: { id: tableInvitation.table.id },
        },
        player: {
          connect: { id: tableInvitation.inviterPlayerId },
        },
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
    declinedReason: string | null,
    isDeclineAll: boolean = false,
  ): Promise<void> {
    const dbTableInvitation: TowersTableInvitationWithRelations = await TableInvitationService.update(
      tableInvitationId,
      {
        status: TableInvitationStatus.DECLINED,
        declinedReason,
      },
    );

    await PlayerManager.updateLastActiveAt(dbTableInvitation.inviterPlayer.id);

    const tableInvitation: TableInvitation = TableInvitationFactory.createTableInvitation(dbTableInvitation);

    const notification: Notification = await NotificationManager.create({
      player: {
        connect: { id: tableInvitation.inviteePlayerId },
      },
      roomId: tableInvitation.roomId,
      type: NotificationType.TABLE_INVITE_DECLINED,
      tableInvitation: {
        connect: { id: tableInvitationId },
      },
    });

    await publishRedisEvent(ServerInternalEvents.TABLE_INVITATION_DECLINE, {
      userId: tableInvitation.inviterPlayerId,
      notification: notification.toPlainObject(),
    });

    logger.debug(
      `${tableInvitation.inviteePlayer?.user?.username} declined invitation to table #${tableInvitation.table?.tableNumber}. Reason: ${declinedReason}`,
    );

    if (isDeclineAll) {
      await this.declineAll(tableInvitation.inviteePlayer.user);
    }
  }

  public static async declineAll(user: User): Promise<void> {
    const tableInvitations: TableInvitation[] = await this.findAllByInviteePlayerId(user.id);
    const pendingInvitations: TableInvitation[] = tableInvitations.filter(
      (ti: TableInvitation) => ti.status === TableInvitationStatus.PENDING,
    );

    for (const pendingInvitation of pendingInvitations) {
      pendingInvitation.status = TableInvitationStatus.DECLINED;
      await this.delete(pendingInvitation.id);
    }

    await UserManager.blockTableInvitations(user.id);
  }

  public static async deleteAllByTableIdAndPlayerId(tableId: string, playerId: string): Promise<void> {
    const invitations: TableInvitation[] = await this.findAllByPlayerId(tableId, playerId);
    await TableInvitationService.deleteAllByTableIdAndPlayerId(tableId, playerId);

    for (const invitation of invitations) {
      invitation.table.removeInvitation(invitation.id);
    }
  }

  public static async delete(id: string): Promise<void> {
    await TableInvitationService.delete(id);
    this.cache.delete(id);
  }
}
