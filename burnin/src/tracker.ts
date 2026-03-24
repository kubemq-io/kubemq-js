/**
 * Bitset-based sequence tracker with sliding window anchored at highContiguous.
 * Detects loss, duplication, and out-of-order delivery.
 *
 * Uses a warmup buffer for the first WARMUP_COUNT messages per producer
 * to determine the actual starting sequence before activating the bitset.
 * This avoids both false-duplicate and false-loss on out-of-order initial delivery.
 */

const WARMUP_COUNT = 64;

interface ProducerState {
  highContiguous: number;
  window: Uint32Array;
  windowBits: number;
  received: number;
  duplicates: number;
  outOfOrder: number;
  confirmedLost: number;
  lastReportedLost: number;
  lastSeen: number;
  warmupBuf: Set<number> | null;
}

export class Tracker {
  private reorderWindow: number;
  private producers = new Map<string, ProducerState>();

  constructor(reorderWindow = 10_000) {
    this.reorderWindow = reorderWindow;
  }

  record(producerId: string, seq: number): { isDuplicate: boolean; isOutOfOrder: boolean } {
    let state = this.producers.get(producerId);
    if (!state) {
      state = {
        highContiguous: 0,
        window: new Uint32Array(Math.ceil(this.reorderWindow / 32)),
        windowBits: this.reorderWindow,
        received: 0,
        duplicates: 0,
        outOfOrder: 0,
        confirmedLost: 0,
        lastReportedLost: 0,
        lastSeen: 0,
        warmupBuf: new Set(),
      };
      this.producers.set(producerId, state);
    }

    // Warmup phase: collect messages to determine starting sequence
    if (state.warmupBuf !== null) {
      if (state.warmupBuf.has(seq)) {
        state.received++;
        state.duplicates++;
        return { isDuplicate: true, isOutOfOrder: false };
      }
      state.warmupBuf.add(seq);
      state.received++;
      if (state.warmupBuf.size >= WARMUP_COUNT) {
        this.finalizeWarmup(state);
      }
      return { isDuplicate: false, isOutOfOrder: false };
    }

    // Normal tracking
    state.received++;

    if (seq <= state.highContiguous) {
      state.duplicates++;
      return { isDuplicate: true, isOutOfOrder: false };
    }

    const offset = seq - state.highContiguous - 1;

    if (offset >= state.windowBits) {
      this.slideTo(state, seq);
    }

    const off2 = seq - state.highContiguous - 1;
    if (getBit(state.window, off2)) {
      state.duplicates++;
      return { isDuplicate: true, isOutOfOrder: false };
    }

    setBit(state.window, off2);

    const isOOO = seq < state.lastSeen;
    if (isOOO) state.outOfOrder++;
    state.lastSeen = Math.max(state.lastSeen, seq);

    // Advance highContiguous through contiguous set bits
    while (getBit(state.window, 0)) {
      state.highContiguous++;
      shiftRight1(state.window);
    }

    return { isDuplicate: false, isOutOfOrder: isOOO };
  }

  private finalizeWarmup(state: ProducerState): void {
    const seqs = Array.from(state.warmupBuf!);
    const minSeq = Math.min(...seqs);
    state.highContiguous = minSeq - 1;
    state.lastSeen = Math.max(...seqs);
    state.warmupBuf = null;
    // Clear the window and replay all warmup seqs into the bitset
    state.window.fill(0);
    for (const s of seqs) {
      const offset = s - state.highContiguous - 1;
      if (offset >= 0 && offset < state.windowBits) {
        setBit(state.window, offset);
      }
    }
    // Advance highContiguous through contiguous set bits
    while (getBit(state.window, 0)) {
      state.highContiguous++;
      shiftRight1(state.window);
    }
  }

  detectGaps(): Map<string, number> {
    const result = new Map<string, number>();
    for (const [pid, state] of this.producers) {
      if (state.warmupBuf !== null) continue;
      const delta = state.confirmedLost - state.lastReportedLost;
      if (delta > 0) {
        result.set(pid, delta);
        state.lastReportedLost = state.confirmedLost;
      }
    }
    return result;
  }

  totalReceived(): number {
    return sum(this.producers, (s) => s.received);
  }
  totalDuplicates(): number {
    return sum(this.producers, (s) => s.duplicates);
  }
  totalOutOfOrder(): number {
    return sum(this.producers, (s) => s.outOfOrder);
  }
  totalLost(): number {
    return sum(this.producers, (s) => s.confirmedLost);
  }

  reset(): void {
    this.producers.clear();
  }

  private slideTo(state: ProducerState, newSeq: number): void {
    const targetHC = newSeq - state.windowBits;
    if (targetHC <= state.highContiguous) return;
    const advance = targetHC - state.highContiguous;
    for (let i = 0; i < advance; i++) {
      if (!getBit(state.window, 0)) state.confirmedLost++;
      state.highContiguous++;
      shiftRight1(state.window);
    }
  }
}

function setBit(arr: Uint32Array, offset: number): void {
  const w = offset >>> 5,
    b = offset & 31;
  if (w < arr.length) arr[w] |= (1 << b) >>> 0;
}

function getBit(arr: Uint32Array, offset: number): boolean {
  const w = offset >>> 5,
    b = offset & 31;
  return w < arr.length ? !!(arr[w] & ((1 << b) >>> 0)) : false;
}

function shiftRight1(arr: Uint32Array): void {
  for (let i = 0; i < arr.length - 1; i++) {
    arr[i] = ((arr[i] >>> 1) | ((arr[i + 1] & 1) << 31)) >>> 0;
  }
  arr[arr.length - 1] = arr[arr.length - 1] >>> 1;
}

function sum(m: Map<string, ProducerState>, fn: (s: ProducerState) => number): number {
  let t = 0;
  for (const s of m.values()) t += fn(s);
  return t;
}
