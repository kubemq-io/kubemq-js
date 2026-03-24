/** @internal */

import { ValidationError, ErrorCode } from '../../errors.js';
import type { EventMessage } from '../../messages/events.js';
import type { EventStoreMessage, EventStoreSubscription } from '../../messages/events-store.js';
import { EventStoreStartPosition } from '../../messages/events-store.js';
import type { QueueMessage, QueuePollRequest } from '../../messages/queues.js';
import type { CommandMessage } from '../../messages/commands.js';
import type { QueryMessage } from '../../messages/queries.js';

function fail(message: string, operation: string, channel?: string, suggestion?: string): never {
  throw new ValidationError({
    code: ErrorCode.ValidationFailed,
    message,
    operation,
    channel,
    isRetryable: false,
    suggestion,
  });
}

function requireNonEmptyChannel(channel: unknown, operation: string): asserts channel is string {
  if (typeof channel !== 'string' || channel.trim().length === 0) {
    fail(
      'Channel name is required and must not be empty',
      operation,
      undefined,
      "Provide a non-empty channel name, e.g., 'my-events'",
    );
  }
}

function requireBody(
  msg: { body?: unknown; metadata?: string; tags?: Record<string, string> },
  operation: string,
): void {
  const hasBody =
    msg.body !== undefined &&
    msg.body !== null &&
    (typeof msg.body === 'string' ? msg.body.length > 0 : (msg.body as Uint8Array).length > 0);
  const hasMetadata = typeof msg.metadata === 'string' && msg.metadata.trim().length > 0;
  const hasTags = msg.tags !== undefined && Object.keys(msg.tags).length > 0;

  if (!hasBody && !hasMetadata && !hasTags) {
    fail(
      'Message must have at least one of: body, metadata, or tags',
      operation,
      (msg as { channel?: string }).channel,
      'Provide a body (string or Uint8Array), metadata string, or tags',
    );
  }
}

function requirePositive(value: number | undefined, field: string, operation: string): void {
  if (value !== undefined && value <= 0) {
    fail(`${field} must be a positive number, got ${String(value)}`, operation);
  }
}

function requireNonNegative(value: number | undefined, field: string, operation: string): void {
  if (value !== undefined && value < 0) {
    fail(`${field} must be non-negative, got ${String(value)}`, operation);
  }
}

function validateChannelFormat(channel: string, allowWildcards: boolean, operation: string): void {
  if (!allowWildcards && /[*>]/.test(channel)) {
    fail(
      'Channel name cannot contain wildcards (* or >)',
      operation,
      channel,
      'Wildcards are only allowed for Events subscribe',
    );
  }
  if (/\s/.test(channel)) {
    fail(
      'Channel name cannot contain whitespace',
      operation,
      channel,
      'Remove whitespace from channel name',
    );
  }
  if (channel.endsWith('.')) {
    fail(
      'Channel name cannot end with "."',
      operation,
      channel,
      'Remove trailing dot from channel name',
    );
  }
}

// ─── Per-Pattern Validators ──────────────────────────────────────────

export function validateEventMessage(msg: EventMessage, operation: string): void {
  requireNonEmptyChannel(msg.channel, operation);
  validateChannelFormat(msg.channel, false, operation);
  requireBody(msg, operation);
}

export function validateEventStoreMessage(msg: EventStoreMessage, operation: string): void {
  requireNonEmptyChannel(msg.channel, operation);
  validateChannelFormat(msg.channel, false, operation);
  requireBody(msg, operation);
}

export function validateQueueMessage(msg: QueueMessage, operation: string): void {
  requireNonEmptyChannel(msg.channel, operation);
  validateChannelFormat(msg.channel, false, operation);
  requireBody(msg, operation);
  if (msg.policy) {
    requireNonNegative(msg.policy.delaySeconds, 'policy.delaySeconds', operation);
    requireNonNegative(msg.policy.expirationSeconds, 'policy.expirationSeconds', operation);
    requireNonNegative(msg.policy.maxReceiveCount, 'policy.maxReceiveCount', operation);
    if (msg.policy.maxReceiveCount !== undefined && msg.policy.maxReceiveCount > 0) {
      if (!msg.policy.maxReceiveQueue || msg.policy.maxReceiveQueue.trim().length === 0) {
        fail(
          'policy.maxReceiveQueue is required when policy.maxReceiveCount > 0',
          operation,
          msg.channel,
          'Provide a dead-letter queue name for rejected messages',
        );
      }
    }
  }
}

export function validateCommandMessage(msg: CommandMessage, operation: string): void {
  requireNonEmptyChannel(msg.channel, operation);
  validateChannelFormat(msg.channel, false, operation);
  requireBody(msg, operation);
  if (msg.timeoutInSeconds <= 0) {
    fail(
      'Command message requires a positive timeoutInSeconds',
      operation,
      msg.channel,
      'Set timeoutInSeconds to the maximum time (in seconds) to wait for a response',
    );
  }
}

export function validateQueryMessage(msg: QueryMessage, operation: string): void {
  requireNonEmptyChannel(msg.channel, operation);
  validateChannelFormat(msg.channel, false, operation);
  requireBody(msg, operation);
  if (msg.timeoutInSeconds <= 0) {
    fail(
      'Query message requires a positive timeoutInSeconds',
      operation,
      msg.channel,
      'Set timeoutInSeconds to the maximum time (in seconds) to wait for a response',
    );
  }
  if (msg.cacheKey && (!msg.cacheTtlInSeconds || msg.cacheTtlInSeconds <= 0)) {
    fail(
      'cacheTtlInSeconds is required and must be > 0 when cacheKey is set',
      operation,
      msg.channel,
      'Set cacheTtlInSeconds to a positive number of seconds',
    );
  }
  if (msg.cacheTtlInSeconds !== undefined) {
    requirePositive(msg.cacheTtlInSeconds, 'cacheTtlInSeconds', operation);
  }
}

export function validateQueuePollRequest(req: QueuePollRequest, operation: string): void {
  requireNonEmptyChannel(req.channel, operation);
  requirePositive(req.waitTimeoutSeconds, 'waitTimeoutSeconds', operation);
  if (req.maxMessages !== undefined) {
    requirePositive(req.maxMessages, 'maxMessages', operation);
  }
  if (req.maxMessages !== undefined && req.maxMessages > 1024) {
    fail('maxMessages must be <= 1024', operation, req.channel);
  }
  if (req.waitTimeoutSeconds > 3600) {
    fail('waitTimeoutSeconds must be <= 3600', operation, req.channel);
  }
  // M4 note: autoAck is accepted but has no wire effect
  // on the unary ReceiveQueueMessages API — server always auto-acks.
}

export function validateSubscription(
  sub: { channel: string; group?: string },
  operation: string,
  allowWildcards = false,
): void {
  requireNonEmptyChannel(sub.channel, operation);
  validateChannelFormat(sub.channel, allowWildcards, operation);
}

export function validateEventStoreSubscription(
  sub: EventStoreSubscription,
  operation: string,
): void {
  requireNonEmptyChannel(sub.channel, operation);
  if (/[*>]/.test(sub.channel)) {
    fail(
      'EventsStore subscriptions do not support wildcard channels',
      operation,
      sub.channel,
      'Use Events subscribe for wildcard patterns',
    );
  }

  if ((sub.startFrom as number | undefined) == null) {
    fail(
      'EventStore subscription requires a startFrom value',
      operation,
      sub.channel,
      'Set startFrom to one of the EventStoreStartPosition values (e.g., EventStoreStartPosition.StartFromNew)',
    );
  }

  if (sub.startFrom === EventStoreStartPosition.StartAtSequence) {
    if (sub.startValue === undefined || sub.startValue <= 0) {
      fail(
        'EventStore subscription with StartAtSequence requires a positive startValue (sequence number)',
        operation,
        sub.channel,
      );
    }
  }

  if (sub.startFrom === EventStoreStartPosition.StartAtTime) {
    if (sub.startValue === undefined || sub.startValue <= 0) {
      fail(
        'EventStore subscription with StartAtTime requires a positive startValue (Unix timestamp in seconds)',
        operation,
        sub.channel,
      );
    }
  }

  if (sub.startFrom === EventStoreStartPosition.StartAtTimeDelta) {
    if (sub.startValue === undefined || sub.startValue <= 0) {
      fail(
        'EventStore subscription with StartAtTimeDelta requires a positive startValue (seconds from now)',
        operation,
        sub.channel,
      );
    }
  }
}

export function validateResponseMessage(
  resp: { id: string; replyChannel: string },
  operation: string,
): void {
  if (!resp.id || resp.id.trim().length === 0) {
    fail('Response id (RequestID) is required', operation);
  }
  if (!resp.replyChannel || resp.replyChannel.trim().length === 0) {
    fail('Response replyChannel is required', operation);
  }
}
