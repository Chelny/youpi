export const ServerToClientEvents = {
  // User
  USER_SETTINGS_AVATAR: "stc:user-settings:avatar",
  USER_RELATIONSHIP_MUTED: "stc:user-relationship:muted",
  USER_RELATIONSHIP_UNMUTED: "stc:user-relationship:unmuted",
  USER_ONLINE: "stc:user:online",
  USER_OFFLINE: "stc:user:offline",
  PING_ECHO: "stc:user:ping:echo",

  // Conversation
  CONVERSATIONS_UNREAD: "stc:conversation:all:unread",
  CONVERSATION_MUTED: "stc:conversation:muted",
  CONVERSATION_MARK_AS_READ: "stc:conversation:read",
  CONVERSATION_UNMUTED: "stc:conversation:unmuted",
  CONVERSATION_REMOVED: "stc:conversation:removed",
  CONVERSATION_RESTORED: "stc:conversation:restored",
  CONVERSATION_MESSAGE_SENT: "stc:conversation:message:sent",

  // Rooms
  ROOMS_LIST_UPDATED: "stc:rooms:list:updated",

  // Room
  ROOM_PLAYER_JOINED: "stc:room:player:joined",
  ROOM_PLAYER_LEFT: "stc:room:player:left",
  ROOM_MESSAGE_SENT: "stc:room:message:sent",

  // Table
  TABLE_PLAYER_JOINED: "stc:table:player:joined",
  TABLE_PLAYER_LEFT: "stc:table:player:left",
  TABLE_PLAYER_UPDATED: "stc:table:player:updated",
  TABLE_MESSAGE_SENT: "stc:table:message:sent",
  TABLE_SEAT_UPDATED: "stc:seat:updated",
  TABLE_UPDATED: "stc:table:updated",
  TABLE_INVITATION_INVITED_NOTIFICATION: "stc:table:invitation:invited",
  TABLE_INVITATION_DECLINED_NOTIFICATION: "stc:table:invitation:declined",
  TABLE_BOOTED_NOTIFICATION: "stc:table:booted",
  TABLE_DELETED: "stc:table:deleted",

  // Game
  GAME_CONTROL_KEYS_UPDATED: "stc:game:control-keys:updated",
  GAME_STATE_UPDATED: "stc:game:state:updated",
  GAME_COUNTDOWN_UPDATED: "stc:game:countdown:updated",
  GAME_TIMER_UPDATED: "stc:game:timer:updated",
  GAME_BOARD_UPDATED: "stc:game:board:updated",
  GAME_CLEAR_BOARDS_UPDATED: "stc:game:boards:clear:updated",
  GAME_OVER: "stc:game:over",
  GAME_POWER_USE: "stc:game:power:use",
  GAME_HOO_SEND_BLOCKS: "stc:game:hoo-send-blocks",
  GAME_BLOCKS_MARKED_FOR_REMOVAL: "stc:game:blocks-marked-for-removal",

  // Notification
  NOTIFICATION_MARK_AS_READ: "stc:notification:read",
  NOTIFICATION_DELETED: "stc:notification:deleted",

  // Socket
  SIGN_OUT_SUCCESS: "stc:sign-out:success",
  SERVER_ERROR: "stc:server:error",
} as const;
