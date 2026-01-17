import { describe, it, expect, beforeEach } from 'vitest';
import { AsyncMutex } from '@/lib/async-mutex';

describe('AsyncMutex', () => {
  let mutex: AsyncMutex;

  beforeEach(() => {
    mutex = new AsyncMutex();
  });

  describe('acquire/release', () => {
    it('acquires lock when not locked', async () => {
      expect(mutex.isLocked()).toBe(false);
      await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
    });

    it('releases lock', async () => {
      await mutex.acquire();
      expect(mutex.isLocked()).toBe(true);
      mutex.release();
      expect(mutex.isLocked()).toBe(false);
    });

    it('queues waiters when locked', async () => {
      await mutex.acquire();
      expect(mutex.queueLength()).toBe(0);

      // Start acquiring but don't await yet
      const promise = mutex.acquire();
      expect(mutex.queueLength()).toBe(1);

      mutex.release();
      await promise;
      expect(mutex.queueLength()).toBe(0);
      expect(mutex.isLocked()).toBe(true);
    });

    it('processes waiters in FIFO order', async () => {
      const order: number[] = [];

      await mutex.acquire();

      // Queue up multiple waiters
      const p1 = mutex.acquire().then(() => order.push(1));
      const p2 = mutex.acquire().then(() => order.push(2));
      const p3 = mutex.acquire().then(() => order.push(3));

      expect(mutex.queueLength()).toBe(3);

      // Release each in sequence
      mutex.release();
      await p1;
      expect(order).toEqual([1]);

      mutex.release();
      await p2;
      expect(order).toEqual([1, 2]);

      mutex.release();
      await p3;
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe('withLock', () => {
    it('acquires and releases lock around function', async () => {
      expect(mutex.isLocked()).toBe(false);

      await mutex.withLock(async () => {
        expect(mutex.isLocked()).toBe(true);
      });

      expect(mutex.isLocked()).toBe(false);
    });

    it('returns function result', async () => {
      const result = await mutex.withLock(async () => {
        return 42;
      });
      expect(result).toBe(42);
    });

    it('releases lock even if function throws', async () => {
      expect(mutex.isLocked()).toBe(false);

      await expect(mutex.withLock(async () => {
        throw new Error('test error');
      })).rejects.toThrow('test error');

      expect(mutex.isLocked()).toBe(false);
    });

    it('serializes concurrent operations', async () => {
      const operations: string[] = [];

      const op = async (name: string, delay: number) => {
        await mutex.withLock(async () => {
          operations.push(`${name}-start`);
          await new Promise(r => setTimeout(r, delay));
          operations.push(`${name}-end`);
        });
      };

      // Start operations concurrently
      const p1 = op('first', 20);
      const p2 = op('second', 10);
      const p3 = op('third', 5);

      await Promise.all([p1, p2, p3]);

      // Despite different delays, operations should complete in order
      expect(operations).toEqual([
        'first-start', 'first-end',
        'second-start', 'second-end',
        'third-start', 'third-end',
      ]);
    });
  });

  describe('race condition prevention', () => {
    it('prevents read-modify-write race conditions', async () => {
      let sharedValue = 0;

      // Simulate a read-modify-write operation
      const increment = async () => {
        await mutex.withLock(async () => {
          const current = sharedValue;
          await new Promise(r => setTimeout(r, 10)); // Simulate async work
          sharedValue = current + 1;
        });
      };

      // Run 5 concurrent increments
      await Promise.all([
        increment(),
        increment(),
        increment(),
        increment(),
        increment(),
      ]);

      // Without mutex, this would likely be < 5 due to race conditions
      expect(sharedValue).toBe(5);
    });

    it('fails without mutex (demonstrating the race condition)', async () => {
      let sharedValue = 0;

      // Same operation but WITHOUT mutex
      const unsafeIncrement = async () => {
        const current = sharedValue;
        await new Promise(r => setTimeout(r, 10));
        sharedValue = current + 1;
      };

      await Promise.all([
        unsafeIncrement(),
        unsafeIncrement(),
        unsafeIncrement(),
        unsafeIncrement(),
        unsafeIncrement(),
      ]);

      // Race condition: all reads happen before any write completes
      expect(sharedValue).toBe(1); // Only the last write survives
    });
  });
});
