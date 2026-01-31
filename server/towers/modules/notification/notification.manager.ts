import { createId } from "@paralleldrive/cuid2";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { Notification, NotificationCreateProps } from "@/server/towers/modules/notification/notification.entity";

export class NotificationManager {
  private static notifications: Map<string, Notification> = new Map<string, Notification>();

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): Notification | undefined {
    return this.notifications.get(id);
  }

  public static all(): Notification[] {
    return [...this.notifications.values()];
  }

  public static create(props: NotificationCreateProps): Notification {
    const notification: Notification = new Notification({ id: createId(), ...props });
    this.notifications.set(notification.id, notification);
    return notification;
  }

  public static async delete(id: string): Promise<void> {
    this.notifications.delete(id);
  }

  // ---------- Notification Actions ------------------------------

  public static getAllByPlayerId(playerId: string): Notification[] {
    return this.all().filter((notification: Notification) => notification.playerId === playerId);
  }

  public static async markAsRead(notificationId: string, userId: string): Promise<void> {
    const notification: Notification | undefined = this.get(notificationId);
    if (!notification) return undefined;

    notification.markAsRead();

    await publishRedisEvent(ServerInternalEvents.NOTIFICATION_MARK_AS_READ, {
      userId,
      notification: notification.toPlainObject(),
    });
  }

  public static async deleteNotification(id: string, userId: string): Promise<void> {
    this.delete(id);
    await publishRedisEvent(ServerInternalEvents.NOTIFICATION_DELETE, { userId, notificationId: id });
  }
}
