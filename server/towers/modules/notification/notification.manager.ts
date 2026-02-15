import { TowersNotificationCreateInput } from "db/models";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Notification } from "@/server/towers/modules/notification/notification.entity";
import { NotificationFactory } from "@/server/towers/modules/notification/notification.factory";
import { NotificationService } from "@/server/towers/modules/notification/notification.service";
import { TowersNotificationWithRelations } from "@/types/prisma";

export class NotificationManager {
  private static cache: Map<string, Notification> = new Map<string, Notification>();

  public static async findById(id: string): Promise<Notification | null> {
    const cached: Notification | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbNotification: TowersNotificationWithRelations | null = await NotificationService.findById(id);
    if (!dbNotification) return null;

    const notification: Notification = NotificationFactory.createNotification(dbNotification);
    this.cache.set(notification.id, notification);

    return notification;
  }

  public static async findAllByPlayerId(playerId: string): Promise<Notification[]> {
    const dbNotifications: TowersNotificationWithRelations[] = await NotificationService.findAllByPlayerId(playerId);

    return dbNotifications.map((dbNotification: TowersNotificationWithRelations) => {
      const notification: Notification = NotificationFactory.createNotification(dbNotification);
      this.cache.set(notification.id, notification);
      return notification;
    });
  }

  public static async create(data: TowersNotificationCreateInput): Promise<Notification> {
    const dbNotification: TowersNotificationWithRelations = await NotificationService.create(data);
    const notification: Notification = NotificationFactory.createNotification(dbNotification);
    this.cache.set(notification.id, notification);
    return notification;
  }

  public static async markAsRead(id: string, userId: string): Promise<void> {
    const dbNotification: TowersNotificationWithRelations = await NotificationService.markAsRead(id);
    const notification: Notification = NotificationFactory.createNotification(dbNotification);

    this.cache.set(notification.id, notification);

    await publishRedisEvent(ServerInternalEvents.NOTIFICATION_MARK_AS_READ, {
      userId,
      notification: notification.toPlainObject(),
    });
  }

  public static async delete(id: string, userId: string): Promise<void> {
    await NotificationService.delete(id);
    this.cache.delete(id);

    await publishRedisEvent(ServerInternalEvents.NOTIFICATION_DELETE, {
      userId,
      notificationId: id,
    });
  }
}
