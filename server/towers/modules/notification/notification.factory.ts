import { TableBootFactory } from "@/server/towers/modules/table-boot/table-boot.factory";
import { TableInvitationFactory } from "@/server/towers/modules/table-invitation/table-invitation.factory";
import { TowersNotificationWithRelations } from "@/types/prisma";
import { Notification } from "./notification.entity";

export class NotificationFactory {
  public static createNotification(dbNotification: TowersNotificationWithRelations): Notification {
    if (dbNotification.tableInvitation) {
      return new Notification({
        ...dbNotification,
        tableInvitation: TableInvitationFactory.createTableInvitation(dbNotification.tableInvitation),
      });
    } else if (dbNotification.bootedFromTable) {
      return new Notification({
        ...dbNotification,
        bootedFromTable: TableBootFactory.createTableBoot(dbNotification.bootedFromTable),
      });
    }

    throw new Error("Invalid createNotification props");
  }
}
