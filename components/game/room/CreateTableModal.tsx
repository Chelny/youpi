"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useLingui } from "@lingui/react/macro";
import { Type } from "@sinclair/typebox";
import { Value, ValueError } from "@sinclair/typebox/value";
import { TableType } from "db/browser";
import Checkbox from "@/components/ui/Checkbox";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { ClientToServerEvents } from "@/constants/socket/client-to-server";
import { useSocket } from "@/context/SocketContext";
import { SocketCallback } from "@/interfaces/socket";
import { logger } from "@/lib/logger";

type CreateTableModalProps = {
  roomId: string
  isSocialRoom: boolean
  onCreateTableSuccess: (tableId: string) => void
  onCancel: () => void
};

export const createTableSchema = Type.Object({
  tableType: Type.Union([
    Type.Literal(TableType.PUBLIC),
    Type.Literal(TableType.PROTECTED),
    Type.Literal(TableType.PRIVATE),
  ]),
  isRated: Type.Boolean(),
});

export type CreateTablePayload = FormPayload<typeof createTableSchema>;
export type CreateTableFormValidationErrors = FormValidationErrors<keyof CreateTablePayload>;

export default function CreateTableModal({
  roomId,
  isSocialRoom,
  onCreateTableSuccess,
  onCancel,
}: CreateTableModalProps): ReactNode {
  const { t } = useLingui();
  const { socketRef, session } = useSocket();
  const [errorMessages, setErrorMessages] = useState<CreateTableFormValidationErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleFormValidation = (event: FormEvent<HTMLFormElement>): void => {
    const formElement: EventTarget & HTMLFormElement = event.currentTarget;
    const formData: FormData = new FormData(formElement);
    const payload: CreateTablePayload = {
      tableType: formData.get("tableType") as TableType,
      isRated: formData.get("isRated") === "on",
    };
    const errors: ValueError[] = Array.from(Value.Errors(createTableSchema, payload));

    for (const error of errors) {
      switch (error.path.replace("/", "")) {
        case "tableType":
          setErrorMessages((prev: CreateTableFormValidationErrors) => ({
            ...prev,
            tableType: t({ message: "You must select a table type." }),
          }));
          break;
        case "isRated":
          setErrorMessages((prev: CreateTableFormValidationErrors) => ({
            ...prev,
            isRated: t({ message: "You must rate this game." }),
          }));
          break;
        default:
          logger.warn(`Create Table Validation: Unknown error at ${error.path}`);
          break;
      }
    }

    if (Object.keys(errorMessages).length === 0) {
      handleCreateTable(payload);
    }
  };

  const handleCreateTable = (body: CreateTablePayload): void => {
    setIsSubmitting(true);

    socketRef.current?.emit(
      ClientToServerEvents.TABLE_CREATE,
      { roomId, hostPlayerId: session?.user.id, tableType: body.tableType, isRated: body.isRated },
      (response: SocketCallback<{ tableId: string }>) => {
        if (response.success && response.data) {
          setIsSubmitting(false);
          onCreateTableSuccess(response.data.tableId);
          onCancel?.();
        }
      },
    );
  };

  return (
    <Modal
      title={t({ message: "Create Table" })}
      confirmText={t({ message: "Create" })}
      isConfirmButtonDisabled={isSubmitting}
      dataTestId="create-table"
      onConfirm={handleFormValidation}
      onCancel={onCancel}
    >
      <Select
        id="tableType"
        label={t({ message: "Table Type" })}
        defaultValue={TableType.PUBLIC}
        required
        errorMessage={errorMessages.tableType}
      >
        <Select.Option value={TableType.PUBLIC}>Public</Select.Option>
        <Select.Option value={TableType.PROTECTED}>Protected</Select.Option>
        <Select.Option value={TableType.PRIVATE}>Private</Select.Option>
      </Select>

      {!isSocialRoom && (
        <Checkbox
          id="isRated"
          label={t({ message: "Rated Game" })}
          defaultChecked={true}
          errorMessage={errorMessages.isRated}
        />
      )}
    </Modal>
  );
}
