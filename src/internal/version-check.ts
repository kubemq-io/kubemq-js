/**
 * Inline semver parser and server version compatibility check.
 *
 * Per REQ-CQ-4, the SDK must NOT depend on the `semver` npm package.
 * This module provides a minimal inline helper for major.minor.patch parsing.
 *
 * @internal
 */

import type { Logger } from '../logger.js';

export interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

/**
 * Parse a semver-like version string into its components.
 * Accepts optional `v` prefix and ignores pre-release suffixes.
 *
 * @returns Parsed version or `undefined` if the string is not parseable.
 */
export function parseVersion(version: string): ParsedVersion | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(version);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: version,
  };
}

/**
 * Check whether `version` satisfies `>= minMajor.minMinor.0`.
 *
 * Logic: major-first comparison, then minor.
 * - If version.major > minMajor → true
 * - If version.major === minMajor && version.minor >= minMinor → true
 * - Otherwise → false
 */
export function versionSatisfiesRange(
  version: ParsedVersion,
  minMajor: number,
  minMinor: number,
): boolean {
  if (version.major > minMajor) return true;
  if (version.major === minMajor && version.minor >= minMinor) return true;
  return false;
}

export const TESTED_SERVER_RANGE = {
  minMajor: 3,
  minMinor: 0,
} as const;

/**
 * Logs a warning if the server version is below the tested range.
 * Never throws — informational only.
 */
export function checkServerCompatibility(serverVersion: string, logger: Logger): void {
  const parsed = parseVersion(serverVersion);
  if (!parsed) {
    logger.warn('Could not parse server version; skipping compatibility check', {
      serverVersion,
    });
    return;
  }

  if (!versionSatisfiesRange(parsed, TESTED_SERVER_RANGE.minMajor, TESTED_SERVER_RANGE.minMinor)) {
    logger.warn(
      `Server version ${parsed.raw} is below the minimum tested version ` +
        `(${String(TESTED_SERVER_RANGE.minMajor)}.${String(TESTED_SERVER_RANGE.minMinor)}.0). ` +
        'The SDK may not work correctly. See COMPATIBILITY.md for the full matrix.',
      {
        serverVersion: parsed.raw,
        minTested: `${String(TESTED_SERVER_RANGE.minMajor)}.${String(TESTED_SERVER_RANGE.minMinor)}.0`,
      },
    );
  }
}
