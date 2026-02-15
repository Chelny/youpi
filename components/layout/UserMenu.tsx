"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { BsChatLeftDots } from "react-icons/bs";
import { PiSignOut } from "react-icons/pi";
import { RiUserLine } from "react-icons/ri";
import ConversationsModal from "@/components/ConversationsModal";
import Anchor from "@/components/ui/Anchor";
import { Avatar, AVATARS } from "@/constants/avatars";
import { ROUTE_ACCOUNT, ROUTE_PROFILE } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useConversation } from "@/context/ConversationContext";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { authClient } from "@/lib/auth-client";

export default function UserMenu(): ReactNode {
  const { openModal } = useModal();
  const { socketRef, session, userAvatars } = useSocket();
  const { i18n, t } = useLingui();
  const { unreadConversationsCount } = useConversation();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const userId: string | undefined = session?.user?.id;
  const menuId: string = userId ? `user-menu-${userId}` : "user-menu";
  const userName: string | undefined = session?.user?.username ?? "";
  const avatarId: string | undefined =
    (userId ? userAvatars[userId] : undefined) ?? session?.user.userSettings?.avatarId;
  const selectedAvatar: Avatar = AVATARS.find((avatar: Avatar) => avatar.id === avatarId) ?? AVATARS[0];

  const handleOpenConversations = (): void => {
    setIsOpen(false);
    openModal(ConversationsModal);
  };

  const handleSignOut = async (): Promise<void> => {
    setIsOpen(false);

    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          socketRef.current?.emit(ClientToServerEvents.SIGN_OUT);
        },
      },
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent): void => {
      const target: Node = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        requestAnimationFrame(() => buttonRef.current?.focus());
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Menu button */}
      <button
        ref={buttonRef}
        type="button"
        className={clsx(
          "relative inline-flex items-center gap-2 px-2 py-1 rounded-md",
          "hover:bg-white/10",
          "focus:outline-none focus:ring-2 focus:ring-white/40",
        )}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((prev: boolean) => !prev)}
        onKeyDown={(event: React.KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setIsOpen((prev: boolean) => !prev);
          }
        }}
      >
        <div className="relative w-10 h-10 rtl:-scale-x-100">
          <Image src={selectedAvatar.src} width={40} height={40} alt={selectedAvatar.description} priority />
          {unreadConversationsCount > 0 && (
            <span
              className={clsx(
                "absolute -top-1.5 -right-1.5 left-auto px-1.5 py-0.5 rounded-full bg-red-500 text-xs font-medium text-white",
                "rtl:-scale-x-100",
              )}
            >
              {unreadConversationsCount > 99 ? "99+" : unreadConversationsCount}
            </span>
          )}
        </div>

        <span className="hidden sm:block max-w-44 truncate text-white/90">{userName}</span>
      </button>

      {/* Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          id={menuId}
          className="absolute end-0 z-dropdown min-w-56 mt-2 border border-white/10 rounded-md shadow-xl bg-user-menu-background text-white overflow-hidden"
          aria-label={t({ message: "User menu" })}
        >
          <div className="px-3 py-2 border-b border-white/10">
            <div className="font-medium truncate">{userName || " "}</div>
            <div className="text-white/60 text-sm truncate">{session?.user?.email}</div>
          </div>

          <MenuLink
            label={i18n._(ROUTE_ACCOUNT.TITLE)}
            Icon={RiUserLine}
            href={ROUTE_PROFILE.PATH}
            onSelect={() => setIsOpen(false)}
          />

          <MenuButton
            label={t({ message: "Conversations" })}
            Icon={BsChatLeftDots}
            rightSlot={
              unreadConversationsCount > 0 ? (
                <span className="px-1.5 py-0.5 border border-red-500/30 rounded-full bg-red-500/20 text-xs">
                  {unreadConversationsCount > 99 ? "99+" : unreadConversationsCount}
                </span>
              ) : null
            }
            onSelect={handleOpenConversations}
          />

          <div className="border-t border-white/20" />

          <MenuButton label={t({ message: "Sign out" })} Icon={PiSignOut} danger onSelect={handleSignOut} />
        </div>
      )}
    </div>
  );
}

function MenuRow({ children, danger }: { children: ReactNode; danger?: boolean }): ReactNode {
  return (
    <div
      className={clsx(
        "flex justify-center items-center gap-4 p-3",
        danger ? "text-red-300 hover:bg-red-500/10" : "text-white/90 hover:bg-youpi-primary/50",
      )}
    >
      {children}
    </div>
  );
}

function MenuLink({
  label,
  Icon,
  href,
  onSelect,
}: {
  label: string
  Icon: React.ComponentType<{ className?: string }>
  href: string
  onSelect?: () => void
}): ReactNode {
  return (
    <Anchor href={href} className="no-underline" onClick={onSelect}>
      <MenuRow>
        <div className="text-white/90">
          <Icon className="h-5 w-5 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
        </div>
        <span className="flex-1">{label}</span>
      </MenuRow>
    </Anchor>
  );
}

function MenuButton({
  label,
  Icon,
  rightSlot,
  danger,
  onSelect,
}: {
  label: string
  Icon: React.ComponentType<{ className?: string }>
  rightSlot?: ReactNode
  danger?: boolean
  onSelect: () => void
}): ReactNode {
  return (
    <button
      type="button"
      className="w-full text-start"
      onClick={onSelect}
      onKeyDown={(event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <MenuRow danger={danger}>
        <Icon className="h-5 w-5 text-white/90 rtl:-scale-y-100 rtl:-rotate-180" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        {rightSlot}
      </MenuRow>
    </button>
  );
}
