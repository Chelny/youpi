import { NotificationPlainObject } from "@/server/towers/modules/notification/notification.entity";

export interface SidebarMenuBaseItem {
  id: string
  label?: string
}

export interface SidebarMenuLinkItem extends SidebarMenuBaseItem {
  href: string
  children?: (SidebarMenuLinkItem | SidebarMenuActionItem)[]
}

export interface SidebarMenuActionItem extends SidebarMenuBaseItem {
  children: NotificationPlainObject[]
  unreadCount: number
}

export interface SidebarMenuDropdownItem extends SidebarMenuBaseItem {
  roomId: string
}

export type MenuItem = SidebarMenuLinkItem | SidebarMenuActionItem | SidebarMenuDropdownItem;
