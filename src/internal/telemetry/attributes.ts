// OTel messaging semantic conventions v1.27.0
// All attribute KEYS and metric names defined as constants.

// ─── Semantic Convention Attribute Constants ────────────────────────

export const MESSAGING_SYSTEM = 'messaging.system' as const;
export const MESSAGING_SYSTEM_VALUE = 'kubemq' as const;
export const MESSAGING_OPERATION_NAME = 'messaging.operation.name' as const;
export const MESSAGING_OPERATION_TYPE = 'messaging.operation.type' as const;
export const MESSAGING_DESTINATION_NAME = 'messaging.destination.name' as const;
export const MESSAGING_MESSAGE_ID = 'messaging.message.id' as const;
export const MESSAGING_CLIENT_ID = 'messaging.client.id' as const;
export const MESSAGING_CONSUMER_GROUP_NAME = 'messaging.consumer.group.name' as const;
export const MESSAGING_BATCH_MESSAGE_COUNT = 'messaging.batch.message_count' as const;
export const MESSAGING_MESSAGE_BODY_SIZE = 'messaging.message.body.size' as const;
export const SERVER_ADDRESS = 'server.address' as const;
export const SERVER_PORT = 'server.port' as const;
export const ERROR_TYPE = 'error.type' as const;

// ─── Operation Names ────────────────────────────────────────────────

export const OP_PUBLISH = 'publish' as const;
export const OP_PROCESS = 'process' as const;
export const OP_RECEIVE = 'receive' as const;
export const OP_SETTLE = 'settle' as const;
export const OP_SEND = 'send' as const;

// ─── Metric Names ───────────────────────────────────────────────────

export const METRIC_OPERATION_DURATION = 'messaging.client.operation.duration' as const;
export const METRIC_SENT_MESSAGES = 'messaging.client.sent.messages' as const;
export const METRIC_CONSUMED_MESSAGES = 'messaging.client.consumed.messages' as const;
export const METRIC_CONNECTION_COUNT = 'messaging.client.connection.count' as const;
export const METRIC_RECONNECTIONS = 'messaging.client.reconnections' as const;
export const METRIC_RETRY_ATTEMPTS = 'kubemq.client.retry.attempts' as const;
export const METRIC_RETRY_EXHAUSTED = 'kubemq.client.retry.exhausted' as const;

// ─── Histogram Bucket Boundaries ────────────────────────────────────

export const DURATION_HISTOGRAM_BOUNDARIES = [
  0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10, 30, 60,
] as const;

// ─── Error Type Metric Values ───────────────────────────────────────

export const ERROR_TYPE_MAP: Readonly<Record<string, string>> = {
  Transient: 'transient',
  Timeout: 'timeout',
  Throttling: 'throttling',
  Authentication: 'authentication',
  Authorization: 'authorization',
  Validation: 'validation',
  NotFound: 'not_found',
  Fatal: 'fatal',
  Cancellation: 'cancellation',
  Backpressure: 'backpressure',
} as const;

// ─── Span Event Names ───────────────────────────────────────────────

export const SPAN_EVENT_RETRY = 'retry' as const;
export const SPAN_EVENT_DEAD_LETTERED = 'message.dead_lettered' as const;

// ─── Instrumentation Scope ──────────────────────────────────────────

export const INSTRUMENTATION_SCOPE_NAME = 'kubemq-js' as const;
