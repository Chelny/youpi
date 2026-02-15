import { Board } from "@/server/towers/game/board/board";
import { Player } from "@/server/towers/modules/player/player.entity";
import { TableService } from "@/server/towers/modules/table/table.service";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TableSeatService } from "@/server/towers/modules/table-seat/table-seat.service";

export class TableSeatManager {
  private static cache: Map<string, TableSeat> = new Map<string, TableSeat>();

  private static all(): TableSeat[] {
    return [...this.cache.values()];
  }

  public static async sitPlayer(tableSeat: TableSeat, player: Player): Promise<void> {
    await TableSeatService.update(tableSeat.id, player.id);
    tableSeat.sit(player);
    this.cache.set(tableSeat.id, tableSeat);
  }

  public static async standPlayer(tableSeat: TableSeat): Promise<void> {
    await TableSeatService.update(tableSeat.id);
    tableSeat.stand();
    this.cache.set(tableSeat.id, tableSeat);
  }

  public static getSeatByPlayerId(tableId: string, playerId: string): TableSeat | undefined {
    return this.all().find((ts: TableSeat) => ts.tableId == tableId && ts.occupiedByPlayerId === playerId);
  }

  public static isPlayerSeated(tableId: string, playerId: string): boolean {
    return typeof this.getSeatByPlayerId(tableId, playerId) !== "undefined";
  }

  public static getSeatByBoard(tableId: string, board: Board): TableSeat | undefined {
    return this.all().find((ts: TableSeat) => ts.tableId == tableId && ts.board === board);
  }

  public static async delete(id: string): Promise<void> {
    await TableService.delete(id);
    this.cache.delete(id);
  }
}
