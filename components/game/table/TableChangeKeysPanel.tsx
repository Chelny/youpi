"use client";

import { ReactNode, useEffect, useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import clsx from "clsx/lite";
import AlertMessage from "@/components/ui/AlertMessage";
import Button from "@/components/ui/Button";
import { fKeyMessages } from "@/constants/f-key-messages";
import { NUM_TABLE_SEATS } from "@/constants/game";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { TablePanelView } from "@/enums/table-panel-view";
import { getReadableKeyLabel } from "@/lib/keyboard/get-readable-key-label";
import { keyboardKeyLabels } from "@/lib/keyboard/keyboard-key-labels";
import { PlayerControlKeysPlainObject } from "@/server/towers/modules/player-control-keys/player-control-keys.entity";

interface TableChangeKeysPanelProps {
  controlKeys: PlayerControlKeysPlainObject | null
  onChangeView: (view: TablePanelView) => void
}

export default function TableChangeKeysPanel({
  controlKeys: initialControlKeys,
  onChangeView,
}: TableChangeKeysPanelProps): ReactNode {
  const { i18n } = useLingui();
  const { socketRef, isConnected } = useSocket();
  const [controlKeys, setControlKeys] = useState<PlayerControlKeysPlainObject | null>(initialControlKeys);
  const [selectedKey, setSelectedKey] = useState<keyof PlayerControlKeysPlainObject | null>(null);
  const [showErrorMessage, setShowErrorMessage] = useState<boolean>(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState<boolean>(false);
  const validKeys: string[] = Object.keys(keyboardKeyLabels);

  const keyUsageMap: Record<string, number> = controlKeys
    ? Object.entries(controlKeys).reduce(
        (map: Record<string, number>, [_, key]: [string, string]) => {
          map[key] = (map[key] || 0) + 1;
          return map;
        },
        {} as Record<string, number>,
      )
    : {};

  const duplicatedKeys: Set<string> = new Set(
    Object.entries(keyUsageMap)
      .filter(([_, count]: [string, number]) => count > 1)
      .map(([key]: [string, number]) => key),
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (!selectedKey) return;
      if (!validKeys.includes(e.code)) return;

      setControlKeys((prev: PlayerControlKeysPlainObject | null) => (prev ? { ...prev, [selectedKey]: e.code } : prev));
      setSelectedKey(null);
      setShowErrorMessage(false);
      setShowSuccessMessage(false);
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedKey, validKeys]);

  const handleSave = (): void => {
    if (duplicatedKeys.size > 0) {
      setShowErrorMessage(true);
      setShowSuccessMessage(false);
    } else {
      setShowErrorMessage(false);
      setShowSuccessMessage(true);
      socketRef.current?.emit(ClientToServerEvents.GAME_CONTROL_KEYS_UPDATE, { controlKeys });
    }
  };

  const renderRow = (
    label: string,
    key: keyof PlayerControlKeysPlainObject,
    isEditable: boolean = false,
  ): ReactNode => {
    const value: string = controlKeys?.[key] ?? "";
    const isDuplicate: boolean = duplicatedKeys.has(value);

    return (
      <div
        key={key}
        className={`flex gap-4 px-2 py-1.5 cursor-${isEditable ? "pointer" : "default"}
          ${selectedKey === key ? "bg-yellow-200 dark:bg-yellow-300 dark:text-black" : ""}
          ${isDuplicate ? "bg-red-200" : "bg-gray-200 dark:bg-slate-700"}`}
        onClick={() => (isEditable ? setSelectedKey(key) : null)}
      >
        <div className="w-7/12">{label}</div>
        <div className="w-5/12">{getReadableKeyLabel(i18n, value)}</div>
      </div>
    );
  };

  return (
    <div className="flex flex-col justify-center items-center">
      <div className="w-full max-w-3xl">
        {showErrorMessage && (
          <AlertMessage type="error">
            <Trans>Duplicate keys detected. Each key must be unique.</Trans>
          </AlertMessage>
        )}

        {showSuccessMessage && (
          <AlertMessage type="success">
            <Trans>Your key bindings have been saved successfully!</Trans>
          </AlertMessage>
        )}
      </div>

      <div className="flex items-evenly gap-6 w-full max-w-5xl pt-2">
        <div className="flex-1 flex flex-col gap-1">
          {renderRow("Move Piece Left", "moveLeft", true)}
          {renderRow("Move Piece Right", "moveRight", true)}
          {renderRow("Cycle Piece Colors", "cycleBlock", true)}
          {renderRow("Drop Piece Quickly", "dropPiece", true)}
          {renderRow("Automatically Use Item", "useItem", true)}

          {Array.from({ length: NUM_TABLE_SEATS }).map((_, index: number) => {
            const keyName: keyof PlayerControlKeysPlainObject =
              `useItemOnPlayer${index + 1}` as keyof PlayerControlKeysPlainObject;
            return renderRow(i18n._("Use Item on Player {number}", { number: index + 1 }), keyName, true);
          })}
        </div>

        <div className="flex-1 flex flex-col gap-1">
          {Array.from({ length: 12 }).map((_, index: number) => {
            const fKey: keyof typeof fKeyMessages = `F${index + 1}` as keyof typeof fKeyMessages;
            return (
              <div key={index} className={clsx("flex gap-4 px-2 py-1.5 bg-gray-200", "dark:bg-slate-700")}>
                <div className="w-1/12">{`F${index + 1}`}</div>
                <div className="w-11/12">{i18n._(fKeyMessages[fKey])}</div>
              </div>
            );
          })}

          <div className="flex flex-col">
            <div className="flex items-evenly gap-2">
              <Button type="button" className="w-full" disabled={!isConnected} onClick={handleSave}>
                <Trans>Save</Trans>
              </Button>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setShowSuccessMessage(false);
                  setShowErrorMessage(false);
                  onChangeView(TablePanelView.GAME);
                }}
              >
                <Trans>Return to the game</Trans>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
