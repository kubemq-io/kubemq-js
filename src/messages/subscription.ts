/**
 * Handle for an active subscription.
 *
 * @remarks
 * **Async safety:** Safe to call `cancel()` from any async context, including
 * from within a subscription callback. Cancellation is idempotent — calling
 * `cancel()` multiple times is safe and has no additional effect.
 */
export interface Subscription {
  cancel(): void;
  readonly isActive: boolean;
}
