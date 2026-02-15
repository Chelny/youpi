import { TableType } from "db/client";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Player } from "@/server/towers/modules/player/player.entity";
import { PlayerManager } from "@/server/towers/modules/player/player.manager.ts";
import { Table } from "@/server/towers/modules/table/table.entity";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TablePlayerFactory } from "@/server/towers/modules/table-player/table-player.factory";
import { TablePlayerService } from "@/server/towers/modules/table-player/table-player.service";
import { TowersTablePlayerWithRelations } from "@/types/prisma";

export class TablePlayerManager {
  private static cache: Map<string, TablePlayer> = new Map<string, TablePlayer>();

  private static getKey(tableId: string, playerId: string): string {
    return `${tableId}:${playerId}`;
  }

  public static async findByTableId(table: Table, playerId: string): Promise<TablePlayer> {
    const key: string = this.getKey(table.id, playerId);

    const cached: TablePlayer | undefined = this.cache.get(key);
    if (cached) return cached;

    const dbRoomPlayer: TowersTablePlayerWithRelations | null = await TablePlayerService.findByTableId(
      table.id,
      playerId,
    );
    if (!dbRoomPlayer) throw new Error("Room Player not found");

    const tablePlayer: TablePlayer = TablePlayerFactory.createTablePlayer(dbRoomPlayer, table);
    this.cache.set(key, tablePlayer);

    return tablePlayer;
  }

  public static async joinTable(table: Table, player: Player): Promise<TablePlayer> {
    const key: string = this.getKey(table.id, player.id);

    const cached: TablePlayer | undefined = this.cache.get(key);
    if (cached) return cached;

    const dbTablePlayer: TowersTablePlayerWithRelations = await TablePlayerService.upsert(table.id, player.id);
    const tablePlayer: TablePlayer = TablePlayerFactory.createTablePlayer(dbTablePlayer, table);

    this.cache.set(key, tablePlayer);
    table.addPlayer(tablePlayer);
    table.room.setPlayerTableNumber(tablePlayer.playerId, table.tableNumber);
    await PlayerManager.updateLastActiveAt(player.id);

    return tablePlayer;
  }

  public static async leaveTable(table: Table, player: Player): Promise<void> {
    const key: string = this.getKey(table.id, player.id);

    const tablePlayer: TablePlayer | undefined = this.cache.get(key);
    if (!tablePlayer) return;

    await TablePlayerService.delete(table.id, player.id);

    this.cache.delete(key);
    table.removePlayer(tablePlayer.playerId);
    table.room.setPlayerTableNumber(tablePlayer.playerId, null);
    await PlayerManager.updateLastActiveAt(player.id);
  }

  public static async upsert(props: TablePlayer): Promise<TablePlayer> {
    const key: string = this.getKey(props.table.id, props.player.id);
    const tablePlayer: TablePlayer | undefined = this.cache.get(key);

    if (tablePlayer) {
      // Update cache
      tablePlayer.isReady = props.isReady;
      tablePlayer.isPlaying = props.isPlaying;

      tablePlayer.table.updatePlayer(tablePlayer);
      await PlayerManager.updateLastActiveAt(tablePlayer.playerId);

      await publishRedisEvent(ServerInternalEvents.TABLE_SEAT_PLAYER_STATE, {
        tableId: tablePlayer.tableId,
        tablePlayer: tablePlayer.toPlainObject(),
      });

      return tablePlayer;
    }

    // If not in cache, create and upsert to DB
    return this.joinTable(props.table, props.player);
  }

  public static async getTablesForPlayer(playerId: string): Promise<TablePlayer[]> {
    const dbTablePlayers: TowersTablePlayerWithRelations[] = await TablePlayerService.findAllByPlayerId(playerId);

    return dbTablePlayers.map((dbTablePlayer: TowersTablePlayerWithRelations) => {
      const table: Table = TableFactory.createTable(dbTablePlayer.table);
      return TablePlayerFactory.createTablePlayer(dbTablePlayer, table);
    });
  }

  /**
   * Determines if the current player can watch another player at a table.
   *
   * Rules:
   * - Target player must currently be playing in a table.
   * - Cannot watch if already seated at the same table.
   * - Cannot watch private tables.
   *
   * @param watcherUserId
   * @param targetUserId
   * @returns The table that can be watched, or `null` if watching is not allowed.
   */
  public static canWatchPlayerAtTable(
    watcherUserId: string,
    targetUserId: string,
  ): { roomId: string; tableId: string } | null {
    // Find the table where the target player is currently playing
    const targetTablePlayer: TablePlayer | undefined = [...this.cache.values()].find(
      (tp: TablePlayer) => tp.playerId === targetUserId && tp.isPlaying,
    );
    if (!targetTablePlayer) return null;

    // Check if this player is already in the same table
    const alreadyAtSameTable: boolean = [...this.cache.values()].some(
      (tp: TablePlayer) => tp.playerId === watcherUserId && tp.tableId === targetTablePlayer.tableId,
    );
    if (alreadyAtSameTable) return null;

    // Cannot watch private tables
    if (targetTablePlayer.table.tableType === TableType.PRIVATE) return null;

    return {
      roomId: targetTablePlayer.table.roomId,
      tableId: targetTablePlayer.tableId,
    };
  }
}
