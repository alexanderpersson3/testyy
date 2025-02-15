const eventTypes = {
  ADMIN: {
    USER_BAN: 'admin.user.ban',
    USER_UNBAN: 'admin.user.unban',
    CONTENT_REMOVE: 'admin.content.remove',
    CONTENT_RESTORE: 'admin.content.restore',
    BAN_LIST_VIEW: 'admin.ban.list.view',
    REMOVED_CONTENT_VIEW: 'admin.content.removed.view',
  },
  USER: {
    PREFERENCES_CREATE: 'user.preferences.create',
    PREFERENCES_UPDATE: 'user.preferences.update',
    NOTIFICATION_SENT: 'user.notification.sent',
    NOTIFICATION_READ: 'user.notification.read',
    NOTIFICATION_DISMISSED: 'user.notification.dismissed',
    DEVICE_ACCESS: 'user.device.access',
    DEVICE_REVOKE: 'user.device.revoke',
    DEVICE_REVOKE_ALL: 'user.device.revoke.all',
    DEVICE_SUSPICIOUS: 'user.device.suspicious',
  },
} as const;

export default eventTypes;