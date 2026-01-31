import { UserSettings as UserSettingsModel } from "db/client";
import { UserSettings, UserSettingsPlainObject } from "@/server/youpi/modules/user-settings/user-settings.entity";

export interface UserProps {
  id: string
  username: string
  userSettings: UserSettingsModel | null
}

export interface UserPlainObject {
  readonly id: string
  readonly username: string
  readonly userSettings?: UserSettingsPlainObject
}

export class User {
  public readonly id: string;
  public username: string;
  public userSettings: UserSettings | null = null;

  // In-memory properties
  public declineTableInvitations: boolean = false;

  constructor(props: UserProps) {
    this.id = props.id;
    this.username = props.username;

    if (props.userSettings) {
      this.userSettings = new UserSettings({
        id: props.userSettings.id,
        avatarId: props.userSettings.avatarId,
        theme: props.userSettings.theme,
        profanityFilter: props.userSettings.profanityFilter,
      });
    } else {
      this.userSettings = null;
    }
  }

  public blockTableInvitations(): void {
    this.declineTableInvitations = true;
  }

  public allowTableInvitations(): void {
    this.declineTableInvitations = false;
  }

  public toPlainObject(): UserPlainObject {
    return {
      id: this.id,
      username: this.username,
      userSettings: this.userSettings?.toPlainObject(),
    };
  }
}
