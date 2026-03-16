import { describe, it, expect } from 'vitest';
import { AsyncSemaphore } from '../../src/internal/concurrency/semaphore.js';

describe('AsyncSemaphore', () => {
  it('throws RangeError when maxConcurrency < 1', () => {
    expect(() => new AsyncSemaphore(0)).toThrow(RangeError);
    expect(() => new AsyncSemaphore(-1)).toThrow(RangeError);
  });

  it('throws RangeError with descriptive message', () => {
    expect(() => new AsyncSemaphore(0)).toThrow('maxConcurrency must be >= 1, got 0');
  });

  it('acquires immediately when permits are available', async () => {
    const sem = new AsyncSemaphore(2);
    expect(sem.available).toBe(2);
    await sem.acquire();
    expect(sem.available).toBe(1);
    await sem.acquire();
    expect(sem.available).toBe(0);
  });

  it('release increases available permits', () => {
    const sem = new AsyncSemaphore(1);
    expect(sem.available).toBe(1);
    sem.release();
    expect(sem.available).toBe(2);
  });

  it('acquire waits when no permits are available', async () => {
    const sem = new AsyncSemaphore(1);
    await sem.acquire();
    expect(sem.available).toBe(0);

    let acquired = false;
    const pendingAcquire = sem.acquire().then(() => {
      acquired = true;
    });

    expect(sem.waiting).toBe(1);
    expect(acquired).toBe(false);

    sem.release();
    await pendingAcquire;
    expect(acquired).toBe(true);
    expect(sem.waiting).toBe(0);
  });

  it('waiting returns correct count of queued acquirers', async () => {
    const sem = new AsyncSemaphore(1);
    await sem.acquire();
    expect(sem.waiting).toBe(0);

    const p1 = sem.acquire();
    const p2 = sem.acquire();
    expect(sem.waiting).toBe(2);

    sem.release();
    await p1;
    expect(sem.waiting).toBe(1);

    sem.release();
    await p2;
    expect(sem.waiting).toBe(0);
  });

  it('available returns 0 when all permits are taken', async () => {
    const sem = new AsyncSemaphore(3);
    await sem.acquire();
    await sem.acquire();
    await sem.acquire();
    expect(sem.available).toBe(0);
  });

  it('release wakes oldest waiter (FIFO)', async () => {
    const sem = new AsyncSemaphore(1);
    await sem.acquire();

    const order: number[] = [];
    const p1 = sem.acquire().then(() => order.push(1));
    const p2 = sem.acquire().then(() => order.push(2));

    sem.release();
    await p1;
    sem.release();
    await p2;

    expect(order).toEqual([1, 2]);
  });

  it('run executes function with acquired permit', async () => {
    const sem = new AsyncSemaphore(1);
    const result = await sem.run(() => 42);
    expect(result).toBe(42);
    expect(sem.available).toBe(1);
  });

  it('run releases permit even on error', async () => {
    const sem = new AsyncSemaphore(1);
    await expect(
      sem.run(() => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(sem.available).toBe(1);
  });

  it('run releases permit after async function', async () => {
    const sem = new AsyncSemaphore(1);
    const result = await sem.run(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return 'done';
    });
    expect(result).toBe('done');
    expect(sem.available).toBe(1);
  });

  it('concurrent run respects concurrency limit', async () => {
    const sem = new AsyncSemaphore(2);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 10));
      concurrent--;
    };

    await Promise.all([sem.run(task), sem.run(task), sem.run(task), sem.run(task)]);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
