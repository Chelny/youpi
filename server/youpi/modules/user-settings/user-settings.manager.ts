import { UserSettings as UserSettingsModel } from "db/client";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { UserSettings, UserSettingsProps } from "@/server/youpi/modules/user-settings/user-settings.entity";
import { UserSettingsService } from "@/server/youpi/modules/user-settings/user-settings.service";

export class UserSettingsManager {
  private static userSettings: Map<string, UserSettings> = new Map<string, UserSettings>();

  // ---------- Database Load ------------------------------

  public static async loadUserSettingsFromDb(id: string): Promise<UserSettings> {
    const db: UserSettingsModel | null = await UserSettingsService.getUserSettingsById(id);
    if (!db) throw new Error(`UserSettings ${id} not found`);
    return this.upsert(db);
  }

  public static async updateUserAvatar(id: string, avatarId: string): Promise<UserSettings> {
    const db: UserSettingsModel = await UserSettingsService.updateAvatar(id, avatarId);
    await publishRedisEvent(ServerInternalEvents.USER_SETTINGS_AVATAR, { userId: id, avatarId });
    return this.upsert(db);
  }

  // public async updateTheme(id: string, theme: WebsiteTheme): Promise<UserSettings> {
  //   const db: UserSettingsModel = await UserSettingsService.updateTheme(id, theme);
  //   return this.upsert(db);
  // }

  // public async updateProfanityFilter(id: string, filter: ProfanityFilter): Promise<UserSettings> {
  //   const db: UserSettingsModel = await UserSettingsService.updateProfanityFilter(id, filter);
  //   return this.upsert(db);
  // }

  // ---------- Basic CRUD ------------------------------

  public static get(id: string): UserSettings | undefined {
    return this.userSettings.get(id);
  }

  public static all(): UserSettings[] {
    return [...this.userSettings.values()];
  }

  public static create(props: UserSettingsProps): UserSettings {
    let userSetting: UserSettings | undefined = this.get(props.id);
    if (userSetting) return userSetting;

    userSetting = new UserSettings(props);
    this.userSettings.set(userSetting.id, userSetting);

    return userSetting;
  }

  public static upsert(props: UserSettingsProps): UserSettings {
    const userSetting: UserSettings | undefined = this.get(props.id);
    if (!userSetting) return this.create(props);
    return Object.assign(userSetting, props);
  }

  public static delete(id: string): void {
    this.userSettings.delete(id);
  }
}
