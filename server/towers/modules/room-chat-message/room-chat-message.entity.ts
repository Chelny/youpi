import {
  ChatMessage,
  ChatMessagePlainObject,
  ChatMessageProps,
} from "@/server/towers/modules/chat-message/chat-message.entity";

export interface RoomChatMessageProps extends ChatMessageProps {
  id: string
  roomId: string
  text: string
}

export interface RoomChatMessagePlainObject extends ChatMessagePlainObject {
  readonly roomId: string
  readonly text: string
}

export class RoomChatMessage extends ChatMessage {
  public roomId: string;
  public text: string;

  constructor(props: RoomChatMessageProps) {
    super(props);
    this.roomId = props.roomId;
    this.text = props.text;
  }

  public override toPlainObject(): RoomChatMessagePlainObject {
    return {
      ...super.toPlainObject(),
      roomId: this.roomId,
      text: this.text,
    };
  }
}
