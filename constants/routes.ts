import { msg } from "@lingui/core/macro";

export const ROUTE_HOME = { ID: "home", TITLE: msg`Home`, PATH: "/" };
export const ROUTE_SIGN_UP = { ID: "sign-up", TITLE: msg`Sign Up`, PATH: "/sign-up" };
export const ROUTE_NEW_USER = { ID: "new-user", TITLE: msg`Complete Your Profile`, PATH: "/new-user" };
export const ROUTE_FORGOT_PASSWORD = { ID: "forgot-password", TITLE: msg`Forgot Password`, PATH: "/forgot-password" };
export const ROUTE_RESET_PASSWORD = { ID: "reset-password", TITLE: msg`Reset Password`, PATH: "/reset-password" };
export const ROUTE_SIGN_IN = { ID: "sign-in", TITLE: msg`Sign In`, PATH: "/sign-in" };
export const ROUTE_SIGN_IN_WITH_MAGIC_LINK = {
  ID: "sign-in-with-magic-link",
  TITLE: msg`Sign In with Magic Link`,
  PATH: "/sign-in-with-magic-link",
};
export const ROUTE_ACCOUNT = { ID: "account", TITLE: msg`Account`, PATH: "/account" };
export const ROUTE_PROFILE = { ID: "account-profile", TITLE: msg`Profile`, PATH: `${ROUTE_ACCOUNT.PATH}/profile` };
export const ROUTE_RELATIONSHIPS = {
  ID: "account-relationships",
  TITLE: msg`Relationships`,
  PATH: `${ROUTE_ACCOUNT.PATH}/relationships`,
};
export const ROUTE_SETTINGS = { ID: "account-settings", TITLE: msg`Settings`, PATH: `${ROUTE_ACCOUNT.PATH}/settings` };
export const ROUTE_DELETE_ACCOUNT = {
  ID: "account-delete-account",
  TITLE: msg`Delete Account`,
  PATH: `${ROUTE_ACCOUNT.PATH}/delete`,
};
export const ROUTE_GAMES = { ID: "games", TITLE: msg`Games`, PATH: "/games" };
export const ROUTE_TOWERS = { ID: "games-towers", TITLE: msg`Towers Rooms`, PATH: `${ROUTE_GAMES.PATH}/towers` };
export const ROUTE_TERMS_OF_SERVICE = {
  ID: "terms-of-service",
  TITLE: msg`Terms of Service`,
  PATH: "/terms-of-service",
};
export const ROUTE_PRIVACY_POLICY = { ID: "privacy-policy", TITLE: msg`Privacy Policy`, PATH: "/privacy-policy" };
export const ROUTE_ERROR = { ID: "error", TITLE: msg`Error`, PATH: "/error" };

export const ROUTES = [
  ROUTE_HOME,
  ROUTE_SIGN_UP,
  ROUTE_NEW_USER,
  ROUTE_FORGOT_PASSWORD,
  ROUTE_RESET_PASSWORD,
  ROUTE_SIGN_IN,
  ROUTE_SIGN_IN_WITH_MAGIC_LINK,
  ROUTE_ACCOUNT,
  ROUTE_PROFILE,
  ROUTE_SETTINGS,
  ROUTE_DELETE_ACCOUNT,
  ROUTE_GAMES,
  ROUTE_TOWERS,
  ROUTE_TERMS_OF_SERVICE,
  ROUTE_PRIVACY_POLICY,
  ROUTE_ERROR,
];

export const PUBLIC_ROUTES = [
  ROUTE_SIGN_UP.PATH,
  ROUTE_FORGOT_PASSWORD.PATH,
  ROUTE_RESET_PASSWORD.PATH,
  ROUTE_SIGN_IN.PATH,
  ROUTE_SIGN_IN_WITH_MAGIC_LINK.PATH,
];

export const PROTECTED_ROUTES = [
  ROUTE_NEW_USER.PATH,
  ROUTE_ACCOUNT.PATH,
  ROUTE_PROFILE.PATH,
  ROUTE_SETTINGS.PATH,
  ROUTE_DELETE_ACCOUNT.PATH,
  ROUTE_GAMES.PATH,
  ROUTE_TOWERS.PATH,
];

export const NEW_USER_CALLBACK_URL = ROUTE_NEW_USER.PATH;
export const CALLBACK_URL = ROUTE_GAMES.PATH;
export const ERROR_CALLBACK_URL = ROUTE_ERROR.PATH;
