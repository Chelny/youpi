export const ClientToServerEvents = {
  // User
  USER_SETTINGS_AVATAR: "cts:user-settings:avatar",
  USER_RELATIONSHIP_MUTE_CHECK: "cts:user-relationship:mute-check",
  USER_RELATIONSHIP_MUTE: "cts:user-relationship:mute",
  USER_RELATIONSHIP_UNMUTE: "cts:user-relationship:unmute",
  USER_CONNECTED: "cts:user:connected",
  USER_DISCONNECTED: "cts:user:disconnected",
  PING_REQUEST: "cts:user:ping:request",

  // Conversation
  CONVERSATIONS: "cts:conversation:all",
  CONVERSATIONS_UNREAD: "cts:conversation:all:unread",
  CONVERSATION: "cts:conversation",
  CONVERSATION_MARK_AS_READ: "cts:conversation:read",
  CONVERSATION_MUTE: "cts:conversation:mute",
  CONVERSATION_UNMUTE: "cts:conversation:unmute",
  CONVERSATION_REMOVE: "cts:conversation:remove",
  CONVERSATION_MESSAGE_SEND: "cts:conversation:message:send",

  // Room
  ROOM_JOIN: "cts:room:join",
  ROOM_LEAVE: "cts:room:leave",
  ROOM_MESSAGE_SEND: "cts:room:message:send",
  ROOM_WATCH_USER_PLAY_AT_TABLE: "cts:game:watch-user-play-at-table",

  // Table
  TABLE_JOIN: "cts:table:join",
  TABLE_LEAVE: "cts:table:leave",
  TABLE_PLAY_NOW: "cts:table:play-now",
  TABLE_CREATE: "cts:table:create",
  TABLE_UPDATE_OPTIONS: "cts:table:options:update",
  TABLE_MESSAGE_SEND: "cts:table:message:send",
  TABLE_PLAYERS_TO_INVITE: "cts:table:players:invite",
  TABLE_INVITE_USER: "cts:table:invite-user",
  TABLE_INVITATION_ACCEPT: "cts:table:invitation:accept",
  TABLE_INVITATION_DECLINE: "cts:table:invitation:decline",
  TABLE_INVITATION_ACCEPTED_CHECK: "cts:table:invitation:accepted:check",
  TABLE_INVITATIONS_BLOCK: "cts:table:invitations:block",
  TABLE_INVITATIONS_ALLOW: "cts:table:invitations:allow",
  TABLE_INVITATIONS_BLOCKED_CHECK: "cts:table:invitations:blocked:check",
  TABLE_PLAYERS_TO_BOOT: "cts:table:players:boot",
  TABLE_BOOT_USER: "cts:table:boot-user",
  TABLE_HERO_CODE: "cts:table:hero-code",

  // Table seats
  TABLE_SEAT_SIT: "cts:table-seat:sit",
  TABLE_SEAT_STAND: "cts:table-seat:stand",
  TABLE_SEAT_READY: "cts:table-seat:ready",

  // Game
  GAME_CONTROL_KEYS: "cts:game:control-keys",
  GAME_CONTROL_KEYS_UPDATE: "cts:game:control-keys:update",
  GAME_POWER_APPLY: "cts:game:power:apply",
  GAME_HOO_ADD_BLOCKS: "cts:game:hoo:add-blocks",
  GAME_CLIENT_BLOCKS_ANIMATION_DONE: "cts:game:client-blocks-animation-done",
  GAME_PIECE_MOVE: "cts:game:piece:move",
  GAME_PIECE_CYCLE: "cts:game:piece:cycle",
  GAME_PIECE_DROP: "cts:game:piece:drop",
  GAME_PIECE_DROP_STOP: "cts:game:piece:drop-stop",
  GAME_POWER_USE: "cts:game:power:use",

  // Notification
  NOTIFICATIONS: "cts:notifications",
  NOTIFICATION_MARK_AS_READ: "cts:notification:read",
  NOTIFICATION_DELETE: "cts:notification:delete",

  // Socket
  SIGN_OUT: "cts:sign-out",
} as const;
