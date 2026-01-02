import { createId } from "@paralleldrive/cuid2";
import { TableType } from "db/client";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Player } from "@/server/towers/classes/Player";
import { TablePlayer, TablePlayerProps } from "@/server/towers/classes/TablePlayer";
import { PlayerManager } from "@/server/towers/managers/PlayerManager";

export class TablePlayerManager {
  private static tablePlayers: Map<string, TablePlayer> = new Map<string, TablePlayer>();

  // ---------- Basic CRUD ------------------------------

  private static getKey(tableId: string, playerId: string): string {
    return `${tableId}:${playerId}`;
  }

  public static get(tableId: string, playerId: string): TablePlayer | undefined {
    const key: string = this.getKey(tableId, playerId);
    return this.tablePlayers.get(key);
  }

  public static all(): TablePlayer[] {
    return [...this.tablePlayers.values()];
  }

  public static create(props: Omit<TablePlayerProps, "id">): TablePlayer {
    const key: string = this.getKey(props.table.id, props.player.id);
    let tablePlayer: TablePlayer | undefined = this.tablePlayers.get(key);
    if (tablePlayer) return tablePlayer;

    tablePlayer = new TablePlayer({ id: createId(), ...props });
    this.tablePlayers.set(key, tablePlayer);
    PlayerManager.updateLastActiveAt(props.player.id);

    return tablePlayer;
  }

  public static async upsert(props: TablePlayer): Promise<TablePlayer> {
    const key: string = this.getKey(props.table.id, props.player.id);
    const tablePlayer: TablePlayer | undefined = this.tablePlayers.get(key);

    if (tablePlayer) {
      tablePlayer.seatNumber = props.seatNumber;

      if (props.isReady !== tablePlayer.isReady) {
        tablePlayer.isReady = props.isReady;
      }

      if (props.isPlaying !== tablePlayer.isPlaying) {
        tablePlayer.isPlaying = props.isPlaying;
      }

      tablePlayer.table.updatePlayer(tablePlayer);
      PlayerManager.updateLastActiveAt(props.player.id);

      await publishRedisEvent(ServerInternalEvents.TABLE_SEAT_PLAYER_STATE, {
        tablePlayer: tablePlayer.toPlainObject(),
      });

      return tablePlayer;
    }

    return this.create(props);
  }

  public static delete(tableId: string, player: Player): void {
    const key: string = this.getKey(tableId, player.id);
    this.tablePlayers.delete(key);
    PlayerManager.updateLastActiveAt(player.id);
  }

  // ---------- Table Player Actions ------------------------------

  public static isInTable(tableId: string, playerId: string): boolean {
    const key: string = this.getKey(tableId, playerId);
    return this.tablePlayers.has(key);
  }

  public static getTablesForPlayer(playerId: string): TablePlayer[] {
    return this.all().filter((tp: TablePlayer) => tp.playerId === playerId);
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
    const targetTablePlayer: TablePlayer | undefined = this.all().find(
      (tp: TablePlayer) => tp.playerId === targetUserId && tp.isPlaying,
    );
    if (!targetTablePlayer) return null;

    // Check if this player is already in the same table
    const alreadyAtSameTable: boolean = this.all().some(
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
