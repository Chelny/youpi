"use client";

import { KeyboardEvent, ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import { useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import { Avatar, AVATARS } from "@/constants/avatars";
import { useAvatarSave } from "@/hooks/useAvatarSave";

type AvatarListboxLayout = "grid" | "vertical";

type AvatarListboxProps = {
  initialAvatarId?: string
  isTitleVisible?: boolean
  layout?: AvatarListboxLayout
  onSelect?: (avatarId: string) => void
};

export function AvatarListbox({
  initialAvatarId = AVATARS[0].id,
  isTitleVisible = false,
  layout = "vertical",
  onSelect,
}: AvatarListboxProps): ReactNode {
  const { t } = useLingui();
  const { saveAvatarDebounced } = useAvatarSave();
  const [avatarId, setAvatarId] = useState<string>(initialAvatarId);

  useEffect(() => {
    setAvatarId(initialAvatarId);
  }, [initialAvatarId]);

  const handleKeyDown = (event: KeyboardEvent): void => {
    const idx: number = AVATARS.findIndex((avatar: Avatar) => avatar.id === avatarId);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next: string = AVATARS[(idx + 1) % AVATARS.length]?.id;
      handleSelectAvatar(next);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev: string = AVATARS[(idx - 1 + AVATARS.length) % AVATARS.length]?.id;
      handleSelectAvatar(prev);
    }
  };

  const handleSelectAvatar = (id: string): void => {
    setAvatarId(id);
    saveAvatarDebounced(id);
    onSelect?.(id);
  };

  return (
    <div>
      {isTitleVisible && <h5>{t({ message: "Avatars:" })}</h5>}
      <div
        className={clsx(
          "py-1.5 border border-gray-400 rounded bg-gray-100",
          "dark:border-slate-500 dark:bg-slate-700",
          layout === "grid" ? "grid grid-cols-5 gap-1 h-full" : "flex flex-col gap-1 h-38 overflow-y-auto",
        )}
        role="listbox"
        tabIndex={0}
        aria-label={t({ message: "Avatars" })}
        onKeyDown={handleKeyDown}
      >
        {AVATARS.map((avatar: Avatar) => {
          const isSelectedAvatar: boolean = avatar.id === avatarId;
          return (
            <button
              key={avatar.id}
              type="button"
              className={clsx(
                "flex justify-center gap-2 px-4 py-1",
                isSelectedAvatar ? "rounded-sm bg-gray-300 dark:bg-slate-500" : "bg-transparent",
              )}
              role="option"
              aria-selected={isSelectedAvatar}
              onClick={() => handleSelectAvatar(avatar.id)}
            >
              <Image src={avatar.src} className="rtl:-scale-x-100" width={32} height={32} alt={avatar.description} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
