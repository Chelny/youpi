import { ProfanityFilter, WebsiteTheme } from "db/enums";

export interface UserSettingsProps {
  id: string
  avatarId: string
  theme: WebsiteTheme
  profanityFilter: ProfanityFilter
}

export interface UserSettingsPlainObject {
  readonly id: string
  readonly avatarId: string
  readonly theme: WebsiteTheme
  readonly profanityFilter: ProfanityFilter
  readonly createdAt: string
  readonly updatedAt: string
}

export class UserSettings {
  public readonly id: string;
  public avatarId: string;
  public theme: WebsiteTheme;
  public profanityFilter: ProfanityFilter;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserSettingsProps) {
    this.id = props.id;
    this.avatarId = props.avatarId;
    this.theme = props.theme;
    this.profanityFilter = props.profanityFilter;
    this.createdAt = new Date();
    this.updatedAt = this.createdAt;
  }

  public toPlainObject(): UserSettingsPlainObject {
    return {
      id: this.id,
      avatarId: this.avatarId,
      theme: this.theme,
      profanityFilter: this.profanityFilter,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }
}
