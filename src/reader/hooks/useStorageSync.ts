/**
 * useStorageSync Hook
 * 
 * Subscribes to storage changes (from sync or other tabs) and updates the
 * reader store reactively. This enables live sync of settings, themes, and
 * presets without requiring a page refresh.
 */

import { useEffect } from 'react';
import { storageFacade } from '@/lib/storage-facade';
import { useReaderStore } from '../store';

// Custom events for notifying components about sync updates
export const SYNC_EVENTS = {
  THEMES_UPDATED: 'flowreader:themes-updated',
  PRESETS_UPDATED: 'flowreader:presets-updated',
  SETTINGS_UPDATED: 'flowreader:settings-updated',
} as const;

/**
 * Dispatch a custom event to notify components about sync updates
 */
function dispatchSyncEvent(eventName: string) {
  window.dispatchEvent(new CustomEvent(eventName));
}

/**
 * Hook that subscribes to chrome.storage changes and updates the reader store.
 * 
 * This enables reactive sync - when remote state is applied via applyRemoteState(),
 * the storage change triggers this hook which updates the Zustand store.
 * 
 * The hook uses updateSettingsFromSync() instead of updateSettings() to avoid
 * re-saving to storage (which would create an infinite loop).
 */
export function useStorageSync() {
  const updateSettingsFromSync = useReaderStore(state => state.updateSettingsFromSync);
  
  useEffect(() => {
    const unsubscribe = storageFacade.onChange((changes) => {
      // Update settings in the store (without re-saving to storage)
      if (changes.settings) {
        updateSettingsFromSync(changes.settings);
        dispatchSyncEvent(SYNC_EVENTS.SETTINGS_UPDATED);
      }
      
      // Notify ThemeSection to refresh custom themes list
      if (changes.customThemes) {
        dispatchSyncEvent(SYNC_EVENTS.THEMES_UPDATED);
      }
      
      // Notify SettingsPanel to refresh presets list
      if (changes.presets) {
        dispatchSyncEvent(SYNC_EVENTS.PRESETS_UPDATED);
      }
    });
    
    return () => unsubscribe();
  }, [updateSettingsFromSync]);
}


