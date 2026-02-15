import { PlayerFactory } from "@/server/towers/modules/player/player.factory";
import { RoomFactory } from "@/server/towers/modules/room/room.factory";
import { TableFactory } from "@/server/towers/modules/table/table.factory";
import { TowersTableInvitationWithRelations } from "@/types/prisma";
import { TableInvitation } from "./table-invitation.entity";

export class TableInvitationFactory {
  public static createTableInvitation(dbTableInvitation: TowersTableInvitationWithRelations): TableInvitation {
    return new TableInvitation({
      ...dbTableInvitation,
      room: RoomFactory.createRoom(dbTableInvitation.room),
      table: TableFactory.createTable(dbTableInvitation.table),
      inviterPlayer: PlayerFactory.createPlayer(dbTableInvitation.inviterPlayer),
      inviteePlayer: PlayerFactory.createPlayer(dbTableInvitation.inviteePlayer),
    });
  }
}
