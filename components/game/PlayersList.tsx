"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Trans } from "@lingui/react/macro";
import clsx from "clsx/lite";
import PlayerInformationModal from "@/components/game/PlayerInformationModal";
import { SortIcon } from "@/components/ui/SortIcon";
import {
  PROVISIONAL_MAX_COMPLETED_GAMES,
  RATING_DIAMOND,
  RATING_GOLD,
  RATING_MASTER,
  RATING_PLATINUM,
} from "@/constants/game";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { useKeyboardActions } from "@/hooks/useKeyboardActions";
import { RoomPlayerPlainObject } from "@/server/towers/modules/room-player/room-player.entity";
import { TablePlayerPlainObject } from "@/server/towers/modules/table-player/table-player.entity";

type PlayersListProps = {
  roomId: string
  players: PlayerListItem[]
  isRatingsVisible?: boolean | null
  isTableNumberVisible?: boolean
  onSelectedPlayer?: (userId: string) => void
};

export default function PlayersList({
  roomId,
  players,
  isRatingsVisible = false,
  isTableNumberVisible = false,
  onSelectedPlayer,
}: PlayersListProps): ReactNode {
  const { session } = useSocket();
  const { openModal } = useModal();
  const [orderBy, setOrderBy] = useState<"name" | "rating" | "table">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>(undefined);
  const [isRTL, setIsRtl] = useState<boolean>(false);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const dividerPosition: string = isRTL ? "calc(100% - 63.7%) 0" : "63.7% 0";
  const dividerPosition1: string = isRTL ? "calc(100% - 39.3%) 0" : "39.3% 0";
  const dividerPosition2: string = isRTL ? "calc(100% - 72.1%) 0" : "72.1% 0";
  const lightLinearGradient: string = "linear-gradient(to bottom, #e5e7eb 0%, #e5e7eb 100%)";
  const darkLinearGradient: string = "linear-gradient(to bottom, #365066 0%, #365066 100%)";
  const lightRepeatingLinear: string =
    "repeating-linear-gradient(0deg, #f9fafb, #f9fafb 50%, transparent 50%, transparent)";
  const darkRepeatingLinear: string =
    "repeating-linear-gradient(0deg, #243342, #243342 50%, transparent 50%, transparent)";

  const bgImages = useMemo(() => {
    return [
      isRatingsVisible && !isTableNumberVisible && (isDarkMode ? darkLinearGradient : lightLinearGradient),
      !isRatingsVisible && isTableNumberVisible && (isDarkMode ? darkLinearGradient : lightLinearGradient),
      isRatingsVisible && isTableNumberVisible && (isDarkMode ? darkLinearGradient : lightLinearGradient),
      isRatingsVisible && isTableNumberVisible && (isDarkMode ? darkLinearGradient : lightLinearGradient),
      isDarkMode ? darkRepeatingLinear : lightRepeatingLinear,
    ]
      .filter(Boolean)
      .join(", ");
  }, [isDarkMode, isRatingsVisible, isTableNumberVisible]);

  const bgPositions = useMemo(() => {
    return [
      isRatingsVisible && !isTableNumberVisible && dividerPosition,
      !isRatingsVisible && isTableNumberVisible && dividerPosition,
      isRatingsVisible && isTableNumberVisible && dividerPosition1,
      isRatingsVisible && isTableNumberVisible && dividerPosition2,
      "0 0",
    ]
      .filter(Boolean)
      .join(", ");
  }, [isRatingsVisible, isTableNumberVisible, dividerPosition, dividerPosition1, dividerPosition2]);

  const bgRepeats = useMemo(() => {
    return [
      isRatingsVisible && !isTableNumberVisible && "no-repeat",
      !isRatingsVisible && isTableNumberVisible && "no-repeat",
      isRatingsVisible && isTableNumberVisible && "no-repeat",
      isRatingsVisible && isTableNumberVisible && "no-repeat",
      "repeat-y",
    ]
      .filter(Boolean)
      .join(", ");
  }, [isRatingsVisible, isTableNumberVisible]);

  const bgSizes = useMemo(() => {
    return [
      isRatingsVisible && !isTableNumberVisible && "2px 100%",
      !isRatingsVisible && isTableNumberVisible && "2px 100%",
      isRatingsVisible && isTableNumberVisible && "2px 100%",
      isRatingsVisible && isTableNumberVisible && "2px 100%",
      "100% 78px",
    ]
      .filter(Boolean)
      .join(", ");
  }, [isRatingsVisible, isTableNumberVisible]);

  const sortedPlayersList = useMemo(() => {
    if (!players) return [];

    return players.slice().sort((a: PlayerListItem, b: PlayerListItem) => {
      switch (orderBy) {
        case "name":
          const nameA: string = a.player.user.username || "";
          const nameB: string = b.player.user.username || "";

          return sortOrder === "asc" ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        case "rating":
          if (!isRatingsVisible) break;

          const isProvisionalA: boolean = a.player.stats.gamesCompleted < PROVISIONAL_MAX_COMPLETED_GAMES;
          const isProvisionalB: boolean = b.player.stats.gamesCompleted < PROVISIONAL_MAX_COMPLETED_GAMES;

          // Add "provisional" first in ASC order
          if (isProvisionalA && !isProvisionalB) return sortOrder === "asc" ? -1 : 1;
          if (!isProvisionalA && isProvisionalB) return sortOrder === "asc" ? 1 : -1;

          const ratingA: number = a.player.stats.rating || 0;
          const ratingB: number = b.player.stats.rating || 0;

          return sortOrder === "asc" ? ratingA - ratingB : ratingB - ratingA;
        case "table":
          const tableNumberA: number = getTableNumber(a) || 0;
          const tableNumberB: number = getTableNumber(b) || 0;

          return sortOrder === "asc" ? tableNumberA - tableNumberB : tableNumberB - tableNumberA;
        default:
          break;
      }

      return 0;
    });
  }, [players, orderBy, sortOrder]);

  useEffect(() => {
    const checkTheme = (): void => {
      setIsRtl(document.documentElement.dir === "rtl");
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };

    checkTheme();

    const observer: MutationObserver = new MutationObserver((mutations: MutationRecord[]) => {
      mutations.forEach((mutation: MutationRecord) => {
        if (mutation.attributeName === "class") {
          checkTheme();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const handleSort = (key: "name" | "rating" | "table"): void => {
    if (orderBy === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setOrderBy(key);
      setSortOrder("asc");
    }
  };

  const handlePlayersRowClick = (playerId: string | undefined): void => {
    if (playerId) {
      setSelectedPlayerId(playerId);
      onSelectedPlayer?.(playerId);
    }
  };

  const handleOpenPlayerInfoModal = (): void => {
    openModal(PlayerInformationModal, {
      roomId,
      selectedPlayer: sortedPlayersList?.find((p: PlayerListItem) => p.playerId === selectedPlayerId)?.player,
      isRatingsVisible,
    });
  };

  const handleRowKeyDown = useKeyboardActions({
    onEnter: () => handlePlayersRowClick(selectedPlayerId),
    onSpace: () => handlePlayersRowClick(selectedPlayerId),
    onKeyI: () => handleOpenPlayerInfoModal(),
    onCtrlEnter: () => handleOpenPlayerInfoModal(),
  });

  return (
    <div
      className={clsx(
        "grid grid-rows-[auto_1fr] h-full border border-gray-200 bg-white",
        "dark:border-dark-game-players-border dark:bg-dark-game-players-row-odd",
      )}
    >
      {/* Players List Heading */}
      <div
        className={clsx(
          "grid gap-1 pe-3 border-b border-gray-200 bg-gray-50",
          "rtl:divide-x-reverse",
          "dark:border-b-dark-game-players-border dark:border-dark-game-players-border dark:divide-dark-game-players-border dark:bg-dark-game-players-header",
          isRatingsVisible && isTableNumberVisible ? "grid-cols-[5fr_4fr_3fr]" : "grid-cols-[8fr_4fr]",
        )}
      >
        <div
          className="flex items-center gap-2 p-2 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => handleSort("name")}
        >
          <span>
            <Trans>Name</Trans>
          </span>
          <SortIcon isActive={orderBy === "name"} direction={sortOrder} variant="alpha" />
        </div>
        {isRatingsVisible && (
          <div
            className="flex items-center gap-2 p-2 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => handleSort("rating")}
          >
            <span>
              <Trans>Rating</Trans>
            </span>
            <SortIcon isActive={orderBy === "rating"} direction={sortOrder} variant="numeric" />
          </div>
        )}
        {isTableNumberVisible && (
          <div
            className="flex items-center gap-2 p-2 cursor-pointer"
            role="button"
            tabIndex={0}
            onClick={() => handleSort("table")}
          >
            <span>
              <Trans>Table</Trans>
            </span>
            <SortIcon isActive={orderBy === "table"} direction={sortOrder} variant="numeric" />
          </div>
        )}
      </div>
      {/* Players List */}
      <div
        className="overflow-y-scroll"
        style={{
          backgroundImage: bgImages,
          backgroundPosition: bgPositions,
          backgroundRepeat: bgRepeats,
          backgroundSize: bgSizes,
          backgroundOrigin: "content-box",
        }}
      >
        {sortedPlayersList?.map((player: PlayerListItem) => (
          <div
            key={player.playerId}
            className={clsx(
              "grid gap-1 cursor-pointer",
              "rtl:divide-x-reverse",
              "dark:divide-dark-game-players-border",
              isRatingsVisible && isTableNumberVisible ? "grid-cols-[5fr_4fr_3fr]" : "grid-cols-[8fr_4fr]",
              selectedPlayerId === player.playerId && "!bg-blue-100 dark:!bg-blue-900",
              player.playerId === session?.user.id && "text-blue-700 dark:text-blue-400",
            )}
            role="button"
            tabIndex={0}
            onClick={() => handlePlayersRowClick(player.playerId)}
            onDoubleClick={handleOpenPlayerInfoModal}
            onKeyDown={handleRowKeyDown}
          >
            <div className="p-2 truncate">
              <div className="flex items-center gap-1">
                {isRatingsVisible && (
                  <div
                    className={clsx(
                      "shrink-0 w-4 h-4",
                      player.player.stats.rating >= RATING_MASTER && "bg-red-400",
                      player.player.stats.rating >= RATING_DIAMOND &&
                        player.player.stats.rating < RATING_MASTER &&
                        "bg-orange-400",
                      player.player.stats.rating >= RATING_PLATINUM &&
                        player.player.stats.rating < RATING_DIAMOND &&
                        "bg-purple-400",
                      player.player.stats.rating >= RATING_GOLD &&
                        player.player.stats.rating < RATING_PLATINUM &&
                        "bg-cyan-600",
                      player.player.stats.rating < RATING_GOLD && "bg-green-600",
                      player.player.stats.gamesCompleted < PROVISIONAL_MAX_COMPLETED_GAMES && "!bg-gray-400",
                    )}
                  />
                )}
                <div className="truncate">{player.player.user.username}</div>
              </div>
            </div>
            {isRatingsVisible && (
              <div className="p-2 truncate">
                {player.player.stats.gamesCompleted >= PROVISIONAL_MAX_COMPLETED_GAMES
                  ? player.player.stats.rating
                  : "provisional"}
              </div>
            )}
            {isTableNumberVisible && <div className="p-2 truncate">{getTableNumber(player)}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

type PlayerListItem = RoomPlayerPlainObject | TablePlayerPlainObject;

function getTableNumber(playerListItem: PlayerListItem): number | null {
  if ("tableNumber" in playerListItem) {
    // RoomPlayerPlainObject
    return playerListItem.tableNumber;
  }

  if ("table" in playerListItem && playerListItem.table?.tableNumber !== null) {
    // TablePlayerPlainObject
    return playerListItem.table.tableNumber;
  }

  return null;
}
