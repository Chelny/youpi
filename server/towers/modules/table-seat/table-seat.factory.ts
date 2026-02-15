import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { TableSeat } from "@/server/towers/modules/table-seat/table-seat.entity";
import { TowersTableSeatWithRelations } from "@/types/prisma";

export class TableSeatFactory {
  public static createTableSeat(dbTableSeat: TowersTableSeatWithRelations): TableSeat {
    return new TableSeat({
      ...dbTableSeat,
      occupiedByPlayer: dbTableSeat.occupiedByPlayer ? PlayerFactory.createPlayer(dbTableSeat.occupiedByPlayer) : null,
    });
  }
}
