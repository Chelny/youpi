import { createId } from "@paralleldrive/cuid2";
import { Board } from "@/server/towers/game/board/board";
import { Player } from "@/server/towers/modules/player/player.entity";
import { TableSeat, TableSeatProps } from "@/server/towers/modules/table-seat/table-seat.entity";

export class TableSeatManager {
  private static tableSeats: Map<string, TableSeat> = new Map<string, TableSeat>();

  // ---------- Basic CRUD ------------------------------

  private static getKey(tableId: string, seatNumber: number): string {
    return `${tableId}:${seatNumber}`;
  }

  public static get(tableId: string, seatNumber: number): TableSeat | undefined {
    const key: string = this.getKey(tableId, seatNumber);
    return this.tableSeats.get(key);
  }

  public static create(props: Omit<TableSeatProps, "id">): TableSeat {
    const key: string = this.getKey(props.tableId, props.seatNumber);
    let tableSeat: TableSeat | undefined = this.tableSeats.get(key);
    if (tableSeat) return tableSeat;

    tableSeat = new TableSeat({ id: createId(), ...props });
    this.tableSeats.set(key, tableSeat);

    return tableSeat;
  }

  public static upsert(props: TableSeatProps): TableSeat {
    const key: string = this.getKey(props.tableId, props.seatNumber);
    const tableSeat: TableSeat | undefined = this.tableSeats.get(key);

    if (tableSeat) {
      tableSeat.occupiedByPlayer = props.occupiedByPlayer;
      return tableSeat;
    }

    return this.create(props);
  }

  public static all(): TableSeat[] {
    return [...this.tableSeats.values()];
  }

  public static delete(tableId: string, seatNumber: number): void {
    const key: string = this.getKey(tableId, seatNumber);
    const tableSeat: TableSeat | undefined = this.tableSeats.get(key);
    if (!tableSeat) return;
    this.tableSeats.delete(key);
  }

  // ---------- Table Seat Actions ------------------------------

  public static sitPlayer(tableSeat: TableSeat, player: Player): void {
    tableSeat.sit(player);
    this.upsert({
      id: tableSeat.id,
      tableId: tableSeat.tableId,
      seatNumber: tableSeat.seatNumber,
      occupiedByPlayer: player,
    });
  }

  public static standPlayer(tableSeat: TableSeat): void {
    tableSeat.stand();
    this.upsert({
      id: tableSeat.id,
      tableId: tableSeat.tableId,
      seatNumber: tableSeat.seatNumber,
      occupiedByPlayer: null,
    });
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
}
