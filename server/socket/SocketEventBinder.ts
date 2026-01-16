import { Socket } from "socket.io";

type AnyFn = <T>(...args: T[]) => void;

interface Listener {
  event: string
  handler: AnyFn
}

export class SocketEventBinder {
  private listeners: Listener[] = [];

  constructor(private socket: Socket) {}

  public bind<T>(event: string, handler: (data: T) => void): void {
    this.listeners.push({ event, handler: handler as AnyFn });
    this.socket.on(event, handler);
  }

  public unbindAll(): void {
    for (const { event, handler } of this.listeners) {
      this.socket.off(event, handler);
    }

    this.listeners = [];
  }
}
