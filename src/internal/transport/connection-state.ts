/**
 * Connection lifecycle states.
 *
 * Transition diagram:
 *   IDLE ──> CONNECTING ──> READY
 *     ^          │             │
 *     │          v             v
 *     │    RECONNECTING ──> READY
 *     │      │  ↺ (self)
 *     v      v
 *       CLOSED (terminal)
 *
 * RECONNECTING → RECONNECTING is a valid self-transition representing
 * a new reconnection attempt. The 'reconnecting' event fires on each attempt.
 *
 * @internal
 */
export enum ConnectionState {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  READY = 'READY',
  RECONNECTING = 'RECONNECTING',
  CLOSED = 'CLOSED',
}

const VALID_TRANSITIONS: ReadonlyMap<ConnectionState, ReadonlySet<ConnectionState>> = new Map([
  [ConnectionState.IDLE, new Set([ConnectionState.CONNECTING, ConnectionState.CLOSED])],
  [
    ConnectionState.CONNECTING,
    new Set([ConnectionState.READY, ConnectionState.RECONNECTING, ConnectionState.CLOSED]),
  ],
  [ConnectionState.READY, new Set([ConnectionState.RECONNECTING, ConnectionState.CLOSED])],
  [
    ConnectionState.RECONNECTING,
    new Set([ConnectionState.RECONNECTING, ConnectionState.READY, ConnectionState.CLOSED]),
  ],
  [ConnectionState.CLOSED, new Set<ConnectionState>()],
]);

export function isValidTransition(from: ConnectionState, to: ConnectionState): boolean {
  return VALID_TRANSITIONS.get(from)?.has(to) ?? false;
}
