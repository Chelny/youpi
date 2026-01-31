import { Socket } from "socket.io";

type SocketHandler<Args extends unknown[]> = (...args: Args) => void;

interface Listener<Args extends unknown[]> {
  event: string
  handler: SocketHandler<Args>
}

export class SocketListener {
  private listeners: Listener<unknown[]>[] = [];

  constructor(private socket: Socket) {}

  public on<Args extends unknown[]>(event: string, handler: SocketHandler<Args>): void {
    this.listeners.push({ event, handler: handler as SocketHandler<unknown[]> });
    this.socket.on(event, handler);
  }

  public dispose(): void {
    for (const { event, handler } of this.listeners) {
      this.socket.off(event, handler);
    }
    this.listeners = [];
  }
}
