/** @internal */
import { randomUUID } from 'node:crypto';

/** @internal */
export function generateId(): string {
  return randomUUID();
}
