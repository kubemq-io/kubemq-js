/**
 * Send-side message size validation.
 * Prevents accidental OOM from oversized payloads before they reach
 * the gRPC serialization layer.
 *
 * @internal
 */

import { ValidationError, ErrorCode } from '../../errors.js';

/**
 * Validate that the message body does not exceed the configured maximum
 * send size. Throws `ValidationError` with an actionable suggestion.
 *
 * @param body - The serialized message body
 * @param maxSendMessageSize - Maximum allowed body size in bytes
 * @param operation - The SDK operation name (for error context)
 * @param channel - The target channel name (for error context)
 */
export function validateMessageSize(
  body: Uint8Array,
  maxSendMessageSize: number,
  operation: string,
  channel?: string,
): void {
  if (body.byteLength > maxSendMessageSize) {
    throw new ValidationError({
      code: ErrorCode.ValidationFailed,
      message: `Message body size (${String(body.byteLength)} bytes) exceeds maximum send size (${String(maxSendMessageSize)} bytes)`,
      operation,
      channel,
      isRetryable: false,
      suggestion: `Reduce message body size or increase maxSendMessageSize in ClientOptions (current: ${String(maxSendMessageSize)})`,
    });
  }
}
