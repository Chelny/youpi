import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { TableBoot } from "@/server/towers/modules/table-boot/table-boot.entity";
import { TowersTableBootWithRelations } from "@/types/prisma";

export class TableBootFactory {
  public static createTableBoot(dbTableBoot: TowersTableBootWithRelations): TableBoot {
    return new TableBoot({
      ...dbTableBoot,
      table: TableFactory.createTable(dbTableBoot.table),
      booterPlayer: PlayerFactory.createPlayer(dbTableBoot.booterPlayer),
      bootedPlayer: PlayerFactory.createPlayer(dbTableBoot.bootedPlayer),
    });
  }
}
