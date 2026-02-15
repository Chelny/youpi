import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { Table } from "@/server/towers/modules/table/table.entity";
import { TablePlayer } from "@/server/towers/modules/table-player/table-player.entity";
import { TowersTablePlayerWithRelations } from "@/types/prisma";

export class TablePlayerFactory {
  public static createTablePlayer(dbTablePlayer: TowersTablePlayerWithRelations, table: Table): TablePlayer {
    return new TablePlayer({
      ...dbTablePlayer,
      table,
      player: PlayerFactory.createPlayer(dbTablePlayer.player),
    });
  }
}
