import { describe, it, expect } from 'vitest';
import {
  ConnectionState,
  isValidTransition,
} from '../../src/internal/transport/connection-state.js';

describe('ConnectionState transitions', () => {
  const validTransitions: [ConnectionState, ConnectionState][] = [
    [ConnectionState.IDLE, ConnectionState.CONNECTING],
    [ConnectionState.IDLE, ConnectionState.CLOSED],
    [ConnectionState.CONNECTING, ConnectionState.READY],
    [ConnectionState.CONNECTING, ConnectionState.RECONNECTING],
    [ConnectionState.CONNECTING, ConnectionState.CLOSED],
    [ConnectionState.READY, ConnectionState.RECONNECTING],
    [ConnectionState.READY, ConnectionState.CLOSED],
    [ConnectionState.RECONNECTING, ConnectionState.RECONNECTING],
    [ConnectionState.RECONNECTING, ConnectionState.READY],
    [ConnectionState.RECONNECTING, ConnectionState.CLOSED],
  ];

  it.each(validTransitions)('%s → %s is valid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(true);
  });

  const invalidTransitions: [ConnectionState, ConnectionState][] = [
    [ConnectionState.CLOSED, ConnectionState.IDLE],
    [ConnectionState.CLOSED, ConnectionState.CONNECTING],
    [ConnectionState.CLOSED, ConnectionState.READY],
    [ConnectionState.CLOSED, ConnectionState.RECONNECTING],
    [ConnectionState.READY, ConnectionState.IDLE],
    [ConnectionState.READY, ConnectionState.CONNECTING],
    [ConnectionState.IDLE, ConnectionState.READY],
    [ConnectionState.IDLE, ConnectionState.RECONNECTING],
  ];

  it.each(invalidTransitions)('%s → %s is invalid', (from, to) => {
    expect(isValidTransition(from, to)).toBe(false);
  });

  it('CLOSED is terminal — no transitions out', () => {
    for (const state of Object.values(ConnectionState)) {
      if (state === ConnectionState.CLOSED) continue;
      expect(isValidTransition(ConnectionState.CLOSED, state)).toBe(false);
    }
  });

  it('self-transition RECONNECTING → RECONNECTING is valid', () => {
    expect(isValidTransition(ConnectionState.RECONNECTING, ConnectionState.RECONNECTING)).toBe(
      true,
    );
  });

  it('self-transition IDLE → IDLE is not valid', () => {
    expect(isValidTransition(ConnectionState.IDLE, ConnectionState.IDLE)).toBe(false);
  });
});
