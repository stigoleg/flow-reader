/**
 * Sync Scheduler
 * 
 * Background sync scheduler that triggers syncs:
 * - On extension startup
 * - After state changes (debounced)
 * - Periodically (every 15 minutes)
 * - With exponential backoff on errors
 */

import { syncService } from './sync-service';
import { storageFacade } from '../storage-facade';


const ALARM_NAME = 'sync-periodic';
const SYNC_INTERVAL_MINUTES = 15;
const MIN_SYNC_INTERVAL_MS = 30000; // 30 seconds minimum between syncs
const DEBOUNCE_MS = 3000; // 3 seconds debounce for state changes

// Exponential backoff settings
const MAX_BACKOFF_MS = 3600000; // 1 hour max
const INITIAL_BACKOFF_MS = 60000; // 1 minute initial


class SyncSchedulerImpl {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSyncTime = 0;
  private consecutiveErrors = 0;
  private storageUnsubscribe: (() => void) | null = null;

  /**
   * Initialize the sync scheduler
   * Call this from the service worker on startup
   */
  async initialize(): Promise<void> {
    // Initialize sync service
    await syncService.initialize();

    // Check if sync is enabled
    const config = await syncService.getConfig();
    if (!config?.enabled) {
      if (import.meta.env.DEV) console.log('SyncScheduler: Sync not enabled, skipping initialization');
      return;
    }

    // Set up periodic alarm
    await this.setupPeriodicAlarm();

    // Listen for storage changes
    this.listenForStateChanges();

    // Listen for sync events to track errors
    syncService.onEvent((event) => {
      if (event.type === 'sync-completed') {
        this.consecutiveErrors = 0;
        this.lastSyncTime = Date.now();
      } else if (event.type === 'sync-failed') {
        this.consecutiveErrors++;
        this.scheduleRetryWithBackoff();
      }
    });

    if (import.meta.env.DEV) console.log('SyncScheduler: Initialized');
  }

  /**
   * Set up Chrome alarm for periodic sync
   */
  private async setupPeriodicAlarm(): Promise<void> {
    // Clear any existing alarm
    await chrome.alarms.clear(ALARM_NAME);

    // Create new periodic alarm
    await chrome.alarms.create(ALARM_NAME, {
      periodInMinutes: SYNC_INTERVAL_MINUTES,
    });

    if (import.meta.env.DEV) console.log(`SyncScheduler: Periodic alarm set for every ${SYNC_INTERVAL_MINUTES} minutes`);
  }

  /**
   * Handle alarm events
   */
  async handleAlarm(alarm: chrome.alarms.Alarm): Promise<void> {
    if (alarm.name !== ALARM_NAME) return;

    if (import.meta.env.DEV) console.log('SyncScheduler: Periodic alarm triggered');
    await this.triggerSync('periodic');
  }

  /**
   * Listen for state changes and trigger debounced sync
   */
  private listenForStateChanges(): void {
    this.storageUnsubscribe = storageFacade.onChange(() => {
      this.scheduleDebouncedSync();
    });
  }

  /**
   * Schedule a debounced sync after state changes
   */
  private scheduleDebouncedSync(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      this.triggerSync('state-change');
    }, DEBOUNCE_MS);
  }

  /**
   * Schedule a retry with exponential backoff
   */
  private scheduleRetryWithBackoff(): void {
    const backoffMs = Math.min(
      INITIAL_BACKOFF_MS * Math.pow(2, this.consecutiveErrors - 1),
      MAX_BACKOFF_MS
    );

    if (import.meta.env.DEV) console.log(`SyncScheduler: Scheduling retry in ${backoffMs / 1000}s (error #${this.consecutiveErrors})`);

    setTimeout(() => {
      this.triggerSync('retry');
    }, backoffMs);
  }

  /**
   * Trigger a sync operation
   */
  private async triggerSync(reason: 'startup' | 'periodic' | 'state-change' | 'retry' | 'manual'): Promise<void> {
    // Check if enough time has passed since last sync
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    if (timeSinceLastSync < MIN_SYNC_INTERVAL_MS && reason !== 'manual') {
      if (import.meta.env.DEV) console.log(`SyncScheduler: Skipping sync (too soon, ${timeSinceLastSync}ms since last)`);
      return;
    }

    // Check if sync service is ready (has provider and passphrase if encryption enabled)
    const isReady = await syncService.isReadyToSync();
    if (!isReady) {
      if (import.meta.env.DEV) console.log('SyncScheduler: Skipping sync (not ready - check provider and passphrase)');
      return;
    }

    if (import.meta.env.DEV) console.log(`SyncScheduler: Triggering sync (reason: ${reason})`);

    try {
      const result = await syncService.syncNow();
      
      if (result.success) {
        if (import.meta.env.DEV) console.log(`SyncScheduler: Sync completed (action: ${result.action})`);
      } else {
        console.warn(`SyncScheduler: Sync failed: ${result.error}`);
      }
    } catch (error) {
      console.error('SyncScheduler: Sync error:', error);
    }
  }

  /**
   * Trigger an immediate sync (for user-initiated syncs)
   */
  async syncNow(): Promise<void> {
    this.lastSyncTime = 0; // Reset to allow immediate sync
    await this.triggerSync('manual');
  }

  /**
   * Clean up the scheduler
   */
  destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.storageUnsubscribe) {
      this.storageUnsubscribe();
      this.storageUnsubscribe = null;
    }
  }

  /**
   * Enable or disable periodic sync
   */
  async setEnabled(enabled: boolean): Promise<void> {
    if (enabled) {
      await this.setupPeriodicAlarm();
      this.listenForStateChanges();
    } else {
      await chrome.alarms.clear(ALARM_NAME);
      this.destroy();
    }
  }
}


export const syncScheduler = new SyncSchedulerImpl();


/**
 * Set up the alarm listener - call this in the service worker
 */
export function setupSyncAlarmListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    syncScheduler.handleAlarm(alarm);
  });
}
