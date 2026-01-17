/**
 * Sync Settings Section
 * 
 * Settings UI for configuring cross-device sync.
 * Allows connecting to Dropbox, OneDrive, or a local folder (for iCloud).
 */

import { useState, useEffect, useCallback } from 'react';
import { syncService } from '@/lib/sync/sync-service';
import { dropboxAdapter } from '@/lib/sync/providers/dropbox-adapter';
import { oneDriveAdapter } from '@/lib/sync/providers/onedrive-adapter';
import { folderAdapter } from '@/lib/sync/providers/folder-adapter';
import type { SyncProviderType, SyncStatus, SyncEvent } from '@/lib/sync/types';
import { SyncStatusBadge, ApiKeyModal, PassphraseModal } from './sync';

// =============================================================================
// TYPES
// =============================================================================

interface ProviderOption {
  type: SyncProviderType;
  name: string;
  description: string;
  icon: string;
  needsApiKey: boolean;
  apiKeyLabel?: string;
}

const PROVIDER_OPTIONS: ProviderOption[] = [
  {
    type: 'folder',
    name: 'Local Folder',
    description: 'Sync to iCloud Drive, Google Drive, or any folder',
    icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z',
    needsApiKey: false,
  },
  {
    type: 'dropbox',
    name: 'Dropbox',
    description: 'Sync via Dropbox cloud storage',
    icon: 'M12 2L2 7l5 3 5-3 5 3 5-3-10-5zm0 6L7 11l5 3 5-3-5-3zm0 8l-5-3-5 3 5 3 5-3 5 3 5-3-5-3-5 3z',
    needsApiKey: true,
    apiKeyLabel: 'Dropbox App Key',
  },
  {
    type: 'onedrive',
    name: 'OneDrive',
    description: 'Sync via Microsoft OneDrive',
    icon: 'M12 4a7 7 0 016.93 6.03A5 5 0 0119 20H6a6 6 0 01-.84-11.95A7 7 0 0112 4z',
    needsApiKey: true,
    apiKeyLabel: 'Microsoft Client ID',
  },
];

// Storage keys for API keys
const API_KEY_STORAGE: Record<string, string> = {
  dropbox: 'dropboxAppKey',
  onedrive: 'onedriveClientId',
};

// =============================================================================
// UTILITIES
// =============================================================================

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

async function storeApiKey(provider: SyncProviderType, apiKey: string): Promise<void> {
  const key = API_KEY_STORAGE[provider];
  if (!key) return;
  
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: apiKey }, () => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve();
      }
    });
  });
}

// =============================================================================
// SYNC SETTINGS SECTION COMPONENT
// =============================================================================

export function SyncSettingsSection() {
  const [status, setStatus] = useState<SyncStatus>({ state: 'disabled' });
  const [connectedProvider, setConnectedProvider] = useState<SyncProviderType | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<ProviderOption | null>(null);
  const [isExistingEncryptedFile, setIsExistingEncryptedFile] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load current sync configuration
  useEffect(() => {
    const loadConfig = async () => {
      const config = await syncService.getConfig();
      if (config?.enabled && config.provider) {
        setConnectedProvider(config.provider);
        setStatus({ state: 'idle', lastSyncTime: config.lastSyncTime ?? undefined });
        
        // Restore the provider adapter so sync can work after page reload
        if (config.provider === 'folder') {
          const restored = await folderAdapter.restoreHandle();
          if (restored) {
            syncService.setProvider(folderAdapter);
          }
        } else if (config.provider === 'dropbox') {
          const connected = await dropboxAdapter.isConnected();
          if (connected) {
            syncService.setProvider(dropboxAdapter);
          }
        } else if (config.provider === 'onedrive') {
          const connected = await oneDriveAdapter.isConnected();
          if (connected) {
            syncService.setProvider(oneDriveAdapter);
          }
        }
      }
    };
    loadConfig();
  }, []);

  // Listen for storage changes to trigger auto-sync
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName !== 'local') return;
      
      const syncTriggerKeys = ['archiveItems', 'positions', 'settings', 'customThemes', 'presets'];
      const hasRelevantChange = syncTriggerKeys.some(key => key in changes);
      
      if (!hasRelevantChange) return;
      
      const isReady = await syncService.isReadyToSync();
      if (!isReady) return;
      
      if (debounceTimer) clearTimeout(debounceTimer);
      
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        console.log('SyncSettingsSection: Auto-syncing after storage change');
        try {
          await syncService.syncNow();
        } catch (error) {
          console.error('SyncSettingsSection: Auto-sync failed:', error);
        }
      }, 3000);
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, []);

  // Subscribe to sync events
  useEffect(() => {
    const unsubscribe = syncService.onEvent((event: SyncEvent) => {
      if (event.type === 'sync-started') {
        setStatus({ state: 'syncing', startedAt: event.timestamp });
      } else if (event.type === 'sync-completed') {
        setStatus({ state: 'idle', lastSyncTime: event.timestamp });
        setError(null);
      } else if (event.type === 'sync-failed') {
        const result = event.data as { error?: string };
        setStatus({ state: 'error', message: result?.error || 'Sync failed', lastAttempt: event.timestamp });
        setError(result?.error || 'Sync failed');
      } else if (event.type === 'provider-connected') {
        const data = event.data as { provider: SyncProviderType };
        setConnectedProvider(data.provider);
        setStatus({ state: 'idle' });
      } else if (event.type === 'provider-disconnected') {
        setConnectedProvider(null);
        setStatus({ state: 'disabled' });
      }
    });

    return unsubscribe;
  }, []);

  const startOAuthFlow = async (option: ProviderOption, apiKey: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      if (option.type === 'dropbox') {
        dropboxAdapter.setAppKey(apiKey);
      } else if (option.type === 'onedrive') {
        oneDriveAdapter.setClientId(apiKey);
      }

      const adapter = option.type === 'dropbox' ? dropboxAdapter : oneDriveAdapter;
      const authUrl = await adapter.startAuth();
      
      const responseUrl = await new Promise<string>((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          { url: authUrl, interactive: true },
          (callbackUrl) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (callbackUrl) {
              resolve(callbackUrl);
            } else {
              reject(new Error('Authentication cancelled'));
            }
          }
        );
      });

      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      
      if (!code) {
        throw new Error('No authorization code received');
      }

      await adapter.completeAuth(code);
      setShowPassphraseModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setPendingProvider(null);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = useCallback(async (option: ProviderOption) => {
    setPendingProvider(option);
    setError(null);

    if (option.type === 'folder') {
      setIsConnecting(true);
      try {
        await folderAdapter.selectFolder();
        
        const remoteState = await syncService.checkRemoteState(folderAdapter);
        
        if (remoteState.exists && remoteState.encrypted) {
          syncService.setProvider(folderAdapter);
          setIsConnecting(false);
          setIsExistingEncryptedFile(true);
          setShowPassphraseModal(true);
          return;
        }
        
        syncService.setProvider(folderAdapter);
        await syncService.configureWithoutEncryption(folderAdapter);
        await syncService.syncNow();
        setPendingProvider(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect');
        setPendingProvider(null);
      } finally {
        setIsConnecting(false);
      }
      return;
    }

    if (option.needsApiKey) {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleApiKeySubmit = useCallback(async (apiKey: string) => {
    if (!pendingProvider) return;
    
    setShowApiKeyModal(false);
    await storeApiKey(pendingProvider.type, apiKey);
    await startOAuthFlow(pendingProvider, apiKey);
  }, [pendingProvider]);

  const handlePassphraseSubmit = useCallback(async (passphrase: string) => {
    if (!pendingProvider) {
      setError('No provider selected');
      return;
    }

    try {
      let adapter;
      if (pendingProvider.type === 'folder') {
        adapter = folderAdapter;
      } else if (pendingProvider.type === 'dropbox') {
        adapter = dropboxAdapter;
      } else {
        adapter = oneDriveAdapter;
      }
      
      syncService.setProvider(adapter);
      await syncService.configure(adapter, passphrase);
      
      setShowPassphraseModal(false);
      setPendingProvider(null);
      setIsExistingEncryptedFile(false);

      await syncService.syncNow();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure sync');
    }
  }, [pendingProvider]);

  const handleDisconnect = useCallback(async () => {
    try {
      await syncService.disconnect();
      setConnectedProvider(null);
      setStatus({ state: 'disabled' });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    }
  }, []);

  const handleSyncNow = useCallback(async () => {
    const config = await syncService.getConfig();
    
    if (config?.encryptionEnabled && !syncService.hasPassphrase()) {
      const provider = PROVIDER_OPTIONS.find(p => p.type === connectedProvider);
      if (provider) {
        setPendingProvider(provider);
        setShowPassphraseModal(true);
      }
      return;
    }

    if (connectedProvider === 'folder') {
      const connected = await folderAdapter.isConnected();
      if (!connected) {
        setError('Folder access lost. Please reconnect to the folder.');
        return;
      }
      syncService.setProvider(folderAdapter);
    } else if (connectedProvider === 'dropbox') {
      const connected = await dropboxAdapter.isConnected();
      if (connected) {
        syncService.setProvider(dropboxAdapter);
      } else {
        setError('Dropbox session expired. Please reconnect.');
        return;
      }
    } else if (connectedProvider === 'onedrive') {
      const connected = await oneDriveAdapter.isConnected();
      if (connected) {
        syncService.setProvider(oneDriveAdapter);
      } else {
        setError('OneDrive session expired. Please reconnect.');
        return;
      }
    }

    const result = await syncService.syncNow();
    if (!result.success && result.error) {
      setError(result.error);
    }
  }, [connectedProvider]);

  const connectedProviderInfo = PROVIDER_OPTIONS.find(p => p.type === connectedProvider);

  return (
    <div className="settings-group">
      <h3>Cross-Device Sync</h3>
      
      <SyncStatusBadge status={status} />

      {error && (
        <div className="text-red-500 text-sm mt-2 p-2 rounded bg-red-500/10">
          {error}
        </div>
      )}

      {connectedProvider ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-current/5">
            <div className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d={connectedProviderInfo?.icon} />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">{connectedProviderInfo?.name}</p>
              <p className="text-xs opacity-60">Connected</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSyncNow}
              disabled={status.state === 'syncing'}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 disabled:opacity-50 transition-colors"
            >
              {status.state === 'syncing' ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 text-sm rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/10 transition-colors"
            >
              Disconnect
            </button>
          </div>

          {status.state === 'idle' && status.lastSyncTime && (
            <p className="text-xs opacity-50 text-center">
              Last synced: {formatRelativeTime(status.lastSyncTime)}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          <p className="text-sm opacity-70 mb-3">
            Sync your reading history and positions across devices.
          </p>
          
          {PROVIDER_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => handleConnect(option)}
              disabled={isConnecting}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-current/20 hover:border-current/40 hover:bg-current/5 disabled:opacity-50 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={option.icon} />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{option.name}</p>
                <p className="text-xs opacity-60 truncate">{option.description}</p>
              </div>
              {isConnecting && pendingProvider?.type === option.type && (
                <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
              )}
            </button>
          ))}
        </div>
      )}

      {showApiKeyModal && pendingProvider && (
        <ApiKeyModal
          provider={pendingProvider}
          onSubmit={handleApiKeySubmit}
          onCancel={() => {
            setShowApiKeyModal(false);
            setPendingProvider(null);
          }}
        />
      )}

      {showPassphraseModal && pendingProvider && (
        <PassphraseModal
          isNewSetup={!connectedProvider && !isExistingEncryptedFile}
          onSubmit={handlePassphraseSubmit}
          onCancel={() => {
            setShowPassphraseModal(false);
            setPendingProvider(null);
            setIsExistingEncryptedFile(false);
          }}
        />
      )}

      <div className="mt-4 text-xs opacity-50 space-y-1">
        <p>Local folder sync stores data unencrypted for automatic syncing.</p>
        <p>Cloud sync encrypts data with your passphrase for security.</p>
      </div>
    </div>
  );
}
