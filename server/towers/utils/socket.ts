/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Server as IoServer } from "socket.io";

export type EventMap = Record<string, (...args: any[]) => void>;
export type EventName<EM extends EventMap> = Extract<keyof EM, string>;
export type EventArgs<EM extends EventMap, E extends EventName<EM>> = EM[E] extends (...args: infer A) => void
  ? A
  : never;
export type BroadcastAckCallback = (error: Error | null, responses: unknown[]) => void;

export interface IntersectionEmitOptions {
  /**
   * Enable broadcast acknowledgement aggregation. If set, the emit will wait up to
   * timeoutMs for clients to ack; responses will be passed to the callback.
   */
  timeoutMs?: number
}

function uniqueNonEmptyRooms(rooms: readonly string[]): string[] {
  const out: string[] = [];
  const seen: Set<string> = new Set<string>();

  for (const room of rooms) {
    if (!room) continue;
    if (seen.has(room)) continue;
    seen.add(room);
    out.push(room);
  }

  return out;
}

async function socketIdsForRoom(io: IoServer, room: string): Promise<Set<string>> {
  const sockets = await io.in(room).fetchSockets();
  return new Set(sockets.map((s) => s.id));
}

/**
 * Computes the set of Socket.IO client IDs that are present in **every** room in `rooms`.
 *
 * This is the engine behind intersection-based targeting:
 * - For each room, it retrieves the connected sockets via `fetchSockets()`.
 * - It converts each room's results to a `Set<string>` of socket IDs.
 * - It intersects the sets in-place for efficiency.
 *
 * Normalization:
 * - Empty room names (`""`) are ignored.
 * - Duplicate room names are removed.
 *
 * Return value:
 * - Returns a `Set<string>` of socket IDs.
 * - Returns an empty set when:
 *   - `rooms` is empty after normalization, or
 *   - any room has zero sockets, or
 *   - the intersection becomes empty during pruning.
 *
 * @param io - Socket.IO server instance.
 * @param rooms - Room names to intersect.
 * @returns Promise resolving to the intersection of socket IDs across all rooms.
 *
 * @example
 * // Find sockets that are in BOTH "roomA" and "roomB"
 * const ids = await intersectSocketIds(io, ["roomA", "roomB"]);
 * // ids is a Set of socket IDs
 *
 * @example
 * // Empty/duplicate/blank rooms are handled
 * const ids = await intersectSocketIds(io, ["admins", "", "admins", "online"]);
 * // effectively intersects ["admins", "online"]
 */
export async function intersectSocketIds(io: IoServer, rooms: readonly string[]): Promise<Set<string>> {
  const uniqueRooms: string[] = uniqueNonEmptyRooms(rooms);
  if (uniqueRooms.length === 0) return new Set<string>();

  const intersection: Set<string> = await socketIdsForRoom(io, uniqueRooms[0]);
  if (intersection.size === 0) return new Set<string>();

  for (let i = 1; i < uniqueRooms.length; i++) {
    const ids: Set<string> = await socketIdsForRoom(io, uniqueRooms[i]);
    if (ids.size === 0) return new Set<string>();

    for (const sid of intersection) {
      if (!ids.has(sid)) intersection.delete(sid);
    }

    if (intersection.size === 0) return new Set<string>();
  }

  return intersection;
}

/**
 * Fluent, intersection-aware emitter interface returned by {@link customIntersectEmit}.
 *
 * Call flow:
 * - `to(rooms)` selects the rooms used to compute the socket-id intersection.
 * - `emit(...)` emits to the resulting socket IDs (with optional ack aggregation).
 * - `emitWithAck(...)` emits with required ack aggregation and a custom timeout.
 *
 * `emit(...)` overload behavior:
 * - Without a callback: fire-and-forget broadcast to the intersection.
 * - With a callback (last argument): enables ack aggregation using a default timeout.
 *
 * Acknowledgements:
 * - When enabled, Socket.IO will wait for clients to acknowledge the event.
 * - The callback receives:
 *   - `error`: `Error | null` (timeout or other ack-related error)
 *   - `responses`: array of payloads returned by each client's ack handler
 *
 * @typeParam EmitEvents - Map of event names to listener signatures.
 */
export interface IntersectionEmitter<EmitEvents extends EventMap> {
  /**
   * Select the rooms to intersect.
   *
   * @param rooms - Room names. Empty strings are ignored; duplicates are removed.
   *
   * @example
   * const emitter = customIntersectEmit<MyEvents>(io);
   * const scoped = emitter.to(["admins", "online"]);
   */
  to(rooms: readonly string[]): {
    /**
     * Emit an event to sockets that belong to **all** selected rooms.
     *
     * @param event - Event name (must exist in `EmitEvents`).
     * @param args - Event payload args, optionally ending with an ack callback.
     * @returns Number of sockets targeted.
     *
     * @example
     * type MyEvents = { "notice": (msg: string) => void };
     * await customIntersectEmit<MyEvents>(io)
     *   .to(["roomA", "roomB"])
     *   .emit("notice", "Hello!");
     *
     * @example
     * // Ack aggregation by adding a callback as the last argument
     * type MyEvents = { "ping": (ts: number) => void };
     * await customIntersectEmit<MyEvents>(io)
     *   .to(["roomA", "roomB"])
     *   .emit("ping", Date.now(), (err, responses) => {
     *     if (err) console.error(err);
     *     else console.log(responses);
     *   });
     */
    emit<E extends EventName<EmitEvents>>(
      event: E,
      ...args: [...EventArgs<EmitEvents, E>, BroadcastAckCallback?]
    ): Promise<number>

    /**
     * Emit an event to sockets that belong to **all** selected rooms, requiring ack aggregation.
     *
     * Use this when you always want acks and you want to control the timeout.
     *
     * @param roomsAck - Ack configuration (currently only `timeoutMs`).
     * @param event - Event name (must exist in `EmitEvents`).
     * @param args - Event payload args ending with a required ack callback.
     * @returns Number of sockets targeted.
     *
     * @example
     * type MyEvents = { "refresh": (scope: "full" | "partial") => void };
     * await customIntersectEmit<MyEvents>(io)
     *   .to(["paid", "beta"])
     *   .emitWithAck({ timeoutMs: 2500 }, "refresh", "full", (err, responses) => {
     *     if (err) console.error("timeout or error:", err);
     *     else console.log("client responses:", responses);
     *   });
     */
    emitWithAck<E extends EventName<EmitEvents>>(
      roomsAck: { timeoutMs: number },
      event: E,
      ...args: [...EventArgs<EmitEvents, E>, BroadcastAckCallback]
    ): Promise<number>
  }
}

/**
 * Builds an **intersection-aware emitter** for Socket.IO.
 *
 * This utility targets **only sockets that are simultaneously in _all_ provided rooms**
 * (i.e., the set intersection of room memberships), and then emits to those exact socket IDs.
 *
 * Why this exists:
 * - Socket.IO can broadcast to rooms, but **"roomA AND roomB"** targeting is not a first-class
 *   primitive. This helper computes the intersection and emits directly to the matching sockets.
 * - Uses `fetchSockets()` (not `allSockets()`) to remain compatible with newer Socket.IO versions.
 *
 * Behavior summary:
 * - `customIntersectEmit(io).to([...rooms])` returns an object with two methods:
 *   - `emit(event, ...args, [ackCb])`
 *   - `emitWithAck({ timeoutMs }, event, ...args, ackCb)`
 * - Both methods return `Promise<number>` = **how many sockets were targeted**.
 * - If there are **no matching sockets**, returns `0` and:
 *   - if an ack callback is present, it is called with `(null, [])`.
 *
 * Important details:
 * - Room list is normalized: empty strings are ignored; duplicates are removed.
 * - Intersection is computed by `intersectSocketIds()` using `fetchSockets()` per room.
 * - If you provide an ack callback to `emit`, a default timeout of **1500ms** is used.
 * - `emitWithAck` always requires an ack callback and uses your supplied `timeoutMs`.
 * - Acks are **aggregated**: responses from all targeted clients are collected and passed to the callback.
 *
 * Type-safety notes:
 * - Event typings come from the `EmitEvents` generic (`EventMap`), so event names and payload
 *   argument types are enforced at compile time.
 * - Socket.IO's ack-aggregation types may not be fully expressible for your installed typings;
 *   the implementation may cast **only the final `.emit(...)` call** to preserve strong typing elsewhere.
 *
 * @typeParam EmitEvents - Map of event names to listener signatures.
 * @param io - Socket.IO server instance.
 * @returns An {@link IntersectionEmitter} factory with a `.to(rooms)` fluent API.
 *
 * @example
 * // 1) Define your server events
 * type ServerEvents = {
 *   "chat:message": (roomId: string, text: string) => void;
 *   "user:kick": (userId: string, reason: string) => void;
 * };
 *
 * const emitter = customIntersectEmit<ServerEvents>(io);
 *
 * // 2) Emit to sockets that are in BOTH "admins" AND "online"
 * const targeted = await emitter
 *   .to(["admins", "online"])
 *   .emit("chat:message", "general", "Hello admins who are online!");
 *
 * // targeted is the number of sockets that matched the intersection
 *
 * @example
 * // Emit with ack aggregation (default timeout = 1500ms) by passing a callback as last arg
 * type ServerEvents = {
 *   "sync:ping": (ts: number) => void;
 * };
 *
 * await customIntersectEmit<ServerEvents>(io)
 *   .to(["roomA", "roomB"])
 *   .emit("sync:ping", Date.now(), (err, responses) => {
 *     if (err) {
 *       // includes timeout or transport errors
 *       console.error(err);
 *       return;
 *     }
 *     // responses is an array of client ack payloads in arrival order
 *     console.log(responses);
 *   });
 *
 * @example
 * // Emit with ack aggregation using a custom timeout
 * type ServerEvents = {
 *   "data:refresh": (scope: "full" | "partial") => void;
 * };
 *
 * await customIntersectEmit<ServerEvents>(io)
 *   .to(["paid", "beta"])
 *   .emitWithAck({ timeoutMs: 3000 }, "data:refresh", "full", (err, responses) => {
 *     if (err) {
 *       console.error("Some clients did not ack in time:", err);
 *       return;
 *     }
 *     console.log("All responses:", responses);
 *   });
 *
 * @example
 * // Zero matches: returns 0; ack callback receives (null, [])
 * type ServerEvents = {
 *   "notice": (msg: string) => void;
 * };
 *
 * const count = await customIntersectEmit<ServerEvents>(io)
 *   .to(["nonexistent-room", "another-room"])
 *   .emit("notice", "Anyone here?", (err, responses) => {
 *     // err === null
 *     // responses === []
 *   });
 * // count === 0
 */
export function customIntersectEmit<EmitEvents extends EventMap>(io: IoServer): IntersectionEmitter<EmitEvents> {
  return {
    to(rooms: readonly string[]) {
      const uniqueRooms: string[] = uniqueNonEmptyRooms(rooms);

      return {
        async emit<E extends EventName<EmitEvents>>(
          event: E,
          ...args: [...EventArgs<EmitEvents, E>, BroadcastAckCallback?]
        ): Promise<number> {
          const last: unknown = args.length ? args[args.length - 1] : undefined;
          const cb: BroadcastAckCallback | undefined =
            typeof last === "function" ? (last as BroadcastAckCallback) : undefined;

          const eventArgs: EventArgs<EmitEvents, E> = cb
            ? (args.slice(0, -1) as unknown as EventArgs<EmitEvents, E>)
            : (args as unknown as EventArgs<EmitEvents, E>);

          const socketIds: Set<string> = await intersectSocketIds(io, uniqueRooms);
          if (socketIds.size === 0) {
            if (cb) cb(null, []);
            return 0;
          }

          const targets: string[] = Array.from(socketIds);

          if (!cb) {
            // no ack
            io.to(targets).emit(event, ...(eventArgs as unknown as any[]));
            return socketIds.size;
          }

          // With ack (default timeout)
          const timeoutMs: number = 1500

          ;(io.timeout(timeoutMs).to(targets) as any).emit(
            event,
            ...(eventArgs as unknown as any[]),
            (err: Error | null, responses: unknown[]) => cb(err, responses),
          );

          return socketIds.size;
        },

        async emitWithAck<E extends EventName<EmitEvents>>(
          roomsAck: { timeoutMs: number },
          event: E,
          ...args: [...EventArgs<EmitEvents, E>, BroadcastAckCallback]
        ): Promise<number> {
          const { timeoutMs }: { timeoutMs: number } = roomsAck;

          const cb: BroadcastAckCallback = args[args.length - 1] as BroadcastAckCallback;
          const eventArgs: EventArgs<EmitEvents, E> = args.slice(0, -1) as unknown as EventArgs<EmitEvents, E>;

          const socketIds: Set<string> = await intersectSocketIds(io, uniqueRooms);
          if (socketIds.size === 0) {
            cb(null, []);
            return 0;
          }

          const targets: string[] = Array.from(socketIds)

          ;(io.timeout(timeoutMs).to(targets) as any).emit(
            event,
            ...(eventArgs as unknown as any[]),
            (err: Error | null, responses: unknown[]) => cb(err, responses),
          );

          return socketIds.size;
        },
      };
    },
  };
}
