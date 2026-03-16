/**
 * Runtime Node.js version assertion.
 *
 * Called once during KubeMQClient.create() to fail fast if the Node.js
 * runtime is below the minimum supported version.
 *
 * @internal
 */

const MIN_NODE_MAJOR = 20;
const MIN_NODE_MINOR = 11;

/**
 * Throws if the current Node.js version is below the SDK minimum.
 * Silently succeeds on non-Node runtimes (Deno, Bun) where
 * `process.version` may be missing or synthetic.
 */
export function assertNodeVersion(): void {
  if (typeof process === 'undefined' || typeof process.version !== 'string') {
    return;
  }

  const match = /^v(\d+)\.(\d+)/.exec(process.version);
  if (!match) return;

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (major < MIN_NODE_MAJOR || (major === MIN_NODE_MAJOR && minor < MIN_NODE_MINOR)) {
    throw new Error(
      `kubemq-js requires Node.js >= ${String(MIN_NODE_MAJOR)}.${String(MIN_NODE_MINOR)}.0. ` +
        `Detected ${process.version}. ` +
        'See COMPATIBILITY.md for supported versions.',
    );
  }
}
