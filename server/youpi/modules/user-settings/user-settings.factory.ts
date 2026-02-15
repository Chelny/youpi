import { UserSettings as UserSettingsModel } from "db/client";
import { UserSettings } from "@/server/youpi/modules/user-settings/user-settings.entity";

export class UserSettingsFactory {
  public static createUserSettings(dbUserSettings: UserSettingsModel): UserSettings {
    return new UserSettings(dbUserSettings);
  }
}
