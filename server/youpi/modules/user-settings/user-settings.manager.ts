import { UserSettings as UserSettingsModel } from "db/client";
import { ServerInternalEvents } from "@/constants/socket/server-internal";
import { publishRedisEvent } from "@/server/redis/publish";
import { UserSettings } from "@/server/youpi/modules/user-settings/user-settings.entity";
import { UserSettingsFactory } from "@/server/youpi/modules/user-settings/user-settings.factory";
import { UserSettingsService } from "@/server/youpi/modules/user-settings/user-settings.service";

export class UserSettingsManager {
  private static cache: Map<string, UserSettings> = new Map<string, UserSettings>();

  public static async findById(id: string): Promise<UserSettings> {
    const cached: UserSettings | undefined = this.cache.get(id);
    if (cached) return cached;

    const dbUserSettings: UserSettingsModel | null = await UserSettingsService.findById(id);
    if (!dbUserSettings) throw new Error(`UserSettings ${id} not found`);

    const userSettings: UserSettings = UserSettingsFactory.createUserSettings(dbUserSettings);
    this.cache.set(userSettings.id, userSettings);

    return userSettings;
  }

  public static async updateUserAvatar(id: string, avatarId: string): Promise<UserSettings> {
    const dbUserSettings: UserSettingsModel = await UserSettingsService.updateAvatar(id, avatarId);

    const userSettings: UserSettings = UserSettingsFactory.createUserSettings(dbUserSettings);
    this.cache.set(userSettings.id, userSettings);

    await publishRedisEvent(ServerInternalEvents.USER_SETTINGS_AVATAR, { userId: id, avatarId });

    return userSettings;
  }

  // public async updateTheme(id: string, theme: WebsiteTheme): Promise<UserSettings> {
  //   const dbUserSettings: UserSettingsModel = await UserSettingsService.updateTheme(id, theme);

  //   const userSettings: UserSettings = UserSettingsFactory.createUserSettings(dbUserSettings);
  //   this.cache.set(userSettings.id, userSettings);

  //   return userSettings;
  // }

  // public async updateProfanityFilter(id: string, filter: ProfanityFilter): Promise<UserSettings> {
  //   const dbUserSettings: UserSettingsModel = await UserSettingsService.updateProfanityFilter(id, filter);

  //   const userSettings: UserSettings = UserSettingsFactory.createUserSettings(dbUserSettings);
  //   this.cache.set(userSettings.id, userSettings);

  //   return userSettings;
  // }

  public static delete(id: string): void {
    this.cache.delete(id);
  }
}
