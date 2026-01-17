/**
 * Simple async mutex for serializing access to shared resources.
 * Used to prevent race conditions in read-modify-write storage operations.
 */
export class AsyncMutex {
  private locked = false;
  private queue: Array<() => void> = [];

  /**
   * Acquire the lock. If already locked, waits until released.
   */
  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }

    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Release the lock and allow the next waiter to proceed.
   */
  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.locked = false;
    }
  }

  /**
   * Execute a function while holding the lock.
   * Automatically releases the lock when done, even if the function throws.
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  /**
   * Check if the mutex is currently locked.
   * Useful for debugging and testing.
   */
  isLocked(): boolean {
    return this.locked;
  }

  /**
   * Get the number of waiters in the queue.
   * Useful for debugging and testing.
   */
  queueLength(): number {
    return this.queue.length;
  }
}

/**
 * Singleton mutex for storage operations.
 * All read-modify-write operations on chrome.storage should use this.
 */
export const storageMutex = new AsyncMutex();
