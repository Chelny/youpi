import { TableChatMessageType } from "db/client";
import { TableType } from "db/client";
import { FKey } from "@/constants/f-key-messages";
import {
  ChatMessage,
  ChatMessagePlainObject,
  ChatMessageProps,
} from "@/server/towers/modules/chat-message/chat-message.entity";

export interface TableChatMessageVariables {
  plainChar?: string
  cipherChar?: string
  fKey?: FKey
  newRating?: number
  oldRating?: number
  heroCode?: string
  tableHostUsername?: string
  tableType?: TableType
  username?: string | null
}

export interface TableChatMessageProps extends ChatMessageProps {
  id: string
  tableId: string
  text: string | null
  type: TableChatMessageType
  textVariables: TableChatMessageVariables | null
  visibleToUserId: string | null
}

export interface TableChatMessagePlainObject extends ChatMessagePlainObject {
  readonly tableId: string
  readonly text: string | null
  readonly type: TableChatMessageType
  readonly textVariables: TableChatMessageVariables | null
  readonly visibleToUserId: string | null
}

export class TableChatMessage extends ChatMessage {
  public readonly tableId: string;
  public text: string | null;
  public type: TableChatMessageType;
  public textVariables: TableChatMessageVariables | null;
  public visibleToUserId: string | null;

  constructor(props: TableChatMessageProps) {
    super(props);
    this.tableId = props.tableId;
    this.text = props.text;
    this.type = props.type;
    this.textVariables = props.textVariables;
    this.visibleToUserId = props.visibleToUserId;
  }

  public override toPlainObject(): TableChatMessagePlainObject {
    return {
      ...super.toPlainObject(),
      tableId: this.tableId,
      text: this.text,
      type: this.type,
      textVariables: this.textVariables,
      visibleToUserId: this.visibleToUserId,
    };
  }
}
