import { ChangeEvent, Dispatch, FormEvent, MouseEvent, ReactNode, SetStateAction, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trans, useLingui } from "@lingui/react/macro";
import { Type } from "@sinclair/typebox";
import { Value, ValueError } from "@sinclair/typebox/value";
import clsx from "clsx/lite";
import { GameState, TableType } from "db/enums";
import TableBootUserModal from "@/components/game/table/TableBootUserModal";
import TableInviteUserModal from "@/components/game/table/TableInviteUserModal";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Select from "@/components/ui/Select";
import { ROUTE_TOWERS } from "@/constants/routes";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useGame } from "@/context/GameContext";
import { useModal } from "@/context/ModalContext";
import { useSocket } from "@/context/SocketContext";
import { TablePanelView } from "@/enums/table-panel-view";
import { SocketCallback } from "@/interfaces/socket";
import { logger } from "@/lib/logger";
import { TableLitePlainObject } from "@/server/towers/modules/table/table.entity";

const changeTableOptionsSchema = Type.Object({
  tableType: Type.Union([
    Type.Literal(TableType.PUBLIC),
    Type.Literal(TableType.PROTECTED),
    Type.Literal(TableType.PRIVATE),
  ]),
  isRated: Type.Boolean(),
});

type ChangeTableOptionsPayload = FormPayload<typeof changeTableOptionsSchema>;
type ChangeTableOptionsFormValidationErrors = FormValidationErrors<keyof ChangeTableOptionsPayload>;

type TableSidebarProps = {
  roomId: string
  isSocialRoom: boolean
  tableId: string
  tableInfo: TableLitePlainObject | null
  gameState: GameState
  seatNumber: number | null
  isReady: boolean
  panelView: TablePanelView
  onStartGame: () => void
  onStand: () => void
  onChangePanelView: Dispatch<SetStateAction<TablePanelView>>
};

export function TableSidebar({
  roomId,
  isSocialRoom,
  tableId,
  tableInfo,
  gameState,
  seatNumber,
  isReady,
  panelView,
  onStartGame,
  onStand,
  onChangePanelView,
}: TableSidebarProps): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { socketRef, isConnected, session } = useSocket();
  const { removeJoinedTable } = useGame();
  const { openModal } = useModal();
  const formRef = useRef<HTMLFormElement>(null);
  const [errorMessages, setErrorMessages] = useState<ChangeTableOptionsFormValidationErrors>({});

  const handleFormValidation = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const formElement: EventTarget & HTMLFormElement = event.currentTarget;
    const formData: FormData = new FormData(formElement);
    const payload: ChangeTableOptionsPayload = {
      tableType: formData.get("tableType") as TableType,
      isRated: formData.get("isRated") === "on",
    };
    const errors: ValueError[] = Array.from(Value.Errors(changeTableOptionsSchema, payload));

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "tableType":
          setErrorMessages((prev: ChangeTableOptionsFormValidationErrors) => ({
            ...prev,
            tableType: t({ message: "You must select a table type." }),
          }));
          break;
        case "isRated":
          setErrorMessages((prev: ChangeTableOptionsFormValidationErrors) => ({
            ...prev,
            isRated: t({ message: "You must rate this game." }),
          }));
          break;
        default:
          logger.warn(`Change Table Options Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (Object.keys(errorMessages).length === 0) {
      handleChangeTableOptions(payload);
    }
  };

  const handleChangeTableOptions = (body: ChangeTableOptionsPayload): void => {
    if (!tableInfo) return;

    const payload: {
      tableId: string
      tableType?: TableType
      isRated?: boolean
    } = {
      tableId,
    };

    if (body.tableType !== tableInfo.tableType) {
      payload.tableType = body.tableType;
    }

    if (body.isRated !== tableInfo.isRated) {
      payload.isRated = body.isRated;
    }

    if (typeof payload.tableType !== "undefined" || typeof payload.isRated !== "undefined") {
      socketRef.current?.emit(ClientToServerEvents.TABLE_UPDATE_OPTIONS, payload);
    }
  };

  const handleOptionChange = (): void => {
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.requestSubmit();
      }
    }, 1500);
  };

  const handleOpenInviteUserModal = (): void => {
    openModal(TableInviteUserModal, {
      roomId,
      tableId,
      isRatingsVisible: !isSocialRoom,
    });
  };

  const handleOpenBootUserModal = (): void => {
    openModal(TableBootUserModal, {
      roomId,
      tableId,
      hostId: tableInfo?.hostPlayerId,
      isRatingsVisible: !isSocialRoom,
    });
  };

  const handleQuitTable = (): void => {
    socketRef.current?.emit(ClientToServerEvents.TABLE_LEAVE, { tableId }, (response: SocketCallback) => {
      if (response.success) {
        removeJoinedTable(tableId);
        router.push(`${ROUTE_TOWERS.PATH}?room=${roomId}`);
      }
    });
  };

  return (
    <form
      ref={formRef}
      className={clsx(
        "[grid-area:sidebar] flex flex-col justify-between p-2 bg-gray-200",
        "dark:bg-dark-game-sidebar-background",
      )}
      noValidate
      onSubmit={handleFormValidation}
    >
      <div className="flex flex-col gap-2">
        <Button
          className="w-full"
          disabled={!isConnected || !seatNumber || isReady || gameState === GameState.PLAYING}
          onClick={onStartGame}
        >
          <Trans>Start</Trans>
        </Button>
        <hr className={clsx("border-1 border-gray-400", "dark:border-slate-500")} />
        <Button
          className="w-full"
          disabled={!isConnected || panelView === TablePanelView.CHANGE_KEYS || gameState === GameState.PLAYING}
          onClick={() => onChangePanelView(TablePanelView.CHANGE_KEYS)}
        >
          <Trans>Change Keys</Trans>
        </Button>
        <Button
          className="w-full"
          disabled={!isConnected || panelView === TablePanelView.DEMO || gameState === GameState.PLAYING}
          onClick={() => onChangePanelView(TablePanelView.DEMO)}
        >
          <Trans>Demo</Trans>
        </Button>
        <hr className={clsx("border-1 border-gray-400", "dark:border-slate-500")} />
        <Button className="w-full" disabled={!isConnected || !seatNumber} onClick={onStand}>
          <Trans>Stand</Trans>
        </Button>
        <div>
          <span className="p-1 rounded-tl-sm rounded-tr-sm bg-sky-700 text-white text-sm">
            <Trans>Table Type</Trans>
          </span>
        </div>
        <Select
          id="tableType"
          defaultValue={tableInfo?.tableType}
          disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
          isNoBottomSpace
          onChange={() => {
            handleOptionChange();
          }}
        >
          <Select.Option value={TableType.PUBLIC}>
            <Trans>Public</Trans>
          </Select.Option>
          <Select.Option value={TableType.PROTECTED}>
            <Trans>Protected</Trans>
          </Select.Option>
          <Select.Option value={TableType.PRIVATE}>
            <Trans>Private</Trans>
          </Select.Option>
        </Select>
        <Button
          className="w-full"
          disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
          onClick={handleOpenInviteUserModal}
        >
          <Trans>Invite</Trans>
        </Button>
        <Button
          className="w-full"
          disabled={!isConnected || session?.user.id !== tableInfo?.hostPlayerId}
          onClick={handleOpenBootUserModal}
        >
          <Trans>Boot</Trans>
        </Button>
        <div>
          <span className="p-1 rounded-tl-sm rounded-tr-sm bg-sky-700 text-white text-sm">
            <Trans>Options</Trans>
          </span>
        </div>
        {!isSocialRoom && (
          <Checkbox
            id="isRated"
            label={t({ message: "Rated Game" })}
            defaultChecked={tableInfo?.isRated}
            disabled={
              !isConnected ||
              session?.user.id !== tableInfo?.hostPlayerId ||
              gameState === GameState.COUNTDOWN ||
              gameState === GameState.PLAYING
            }
            isNoBottomSpace
            onChange={handleOptionChange}
          />
        )}
        <Checkbox
          id="sound"
          label={t({ message: "Sound" })}
          disabled
          isNoBottomSpace
          onChange={(event: ChangeEvent<HTMLInputElement>) => console.log(event.target.checked)}
        />
      </div>
      <div className="flex gap-1">
        <Button className="w-full" disabled onClick={(_: MouseEvent<HTMLButtonElement>) => {}}>
          <Trans>Help</Trans>
        </Button>
        <Button className="w-full" onClick={handleQuitTable}>
          <Trans>Quit</Trans>
        </Button>
      </div>
    </form>
  );
}
