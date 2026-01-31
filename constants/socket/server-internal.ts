export const ServerInternalEvents = {
  // User
  USER_SETTINGS_AVATAR: "server:user-settings:avatar",
  USER_RELATIONSHIP_MUTE: "server:user-relationship:mute",
  USER_RELATIONSHIP_UNMUTE: "server:user-relationship:unmute",

  // Conversation
  CONVERSATION_MARK_AS_READ: "server:conversation:read",
  CONVERSATION_MUTE: "server:conversation:mute",
  CONVERSATION_UNMUTE: "server:conversation:unmute",
  CONVERSATION_REMOVE: "server:conversation:remove",
  CONVERSATION_RESTORE: "server:conversation:restore",
  CONVERSATION_MESSAGE_SEND: "server:conversation:message:send",

  // Room
  ROOM_JOIN: "server:room:join",
  ROOM_LEAVE: "server:room:leave",
  ROOM_MESSAGE_SEND: "server:room:message:send",

  // Table
  TABLE_JOIN: "server:table:join",
  TABLE_LEAVE: "server:table:leave",
  TABLE_OPTIONS_UPDATE: "server:table:options:update",
  TABLE_MESSAGE_SEND: "server:table:message:send",
  TABLE_INVITE_USER: "server:table:invite-user",
  TABLE_INVITATION_ACCEPT: "server:table:invitation:accept",
  TABLE_INVITATION_DECLINE: "server:table:invitation:decline",
  TABLE_BOOT_USER: "server:table:boot-user",
  TABLE_HOST_LEAVE: "server:table:host:leave",
  TABLE_DELETE: "server:table:delete",

  // Table seats
  TABLE_SEAT_SIT: "server:table-seat:sit",
  TABLE_SEAT_STAND: "server:table-seat:stand",
  TABLE_SEAT_PLAYER_STATE: "server:table-seat:player-state",

  // Game
  GAME_CONTROL_KEYS_UPDATE: "server:game:control-keys:update",
  GAME_STATE: "server:game:state",
  GAME_COUNTDOWN: "server:game:countdown",
  GAME_TIMER: "server:game:timer",
  GAME_BOARD: "server:game:board:update",
  GAME_CLEAR_BOARDS: "server:game:boards:clear",
  GAME_OVER: "server:game:over",
  GAME_POWER_USE: "server:game:power:use",
  GAME_HOO_SEND_BLOCKS: "server:game:hoo-send-blocks",
  GAME_BLOCKS_MARKED_FOR_REMOVAL: "server:game:blocks:marked-for-removal",

  // Notification
  NOTIFICATION_MARK_AS_READ: "server:notification:read",
  NOTIFICATION_DELETE: "server:notification:delete",
} as const;
