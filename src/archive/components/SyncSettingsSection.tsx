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
  apiKeyHelp?: string;
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
    apiKeyHelp: 'Create an app at dropbox.com/developers/apps',
  },
  {
    type: 'onedrive',
    name: 'OneDrive',
    description: 'Sync via Microsoft OneDrive',
    icon: 'M12 4a7 7 0 016.93 6.03A5 5 0 0119 20H6a6 6 0 01-.84-11.95A7 7 0 0112 4z',
    needsApiKey: true,
    apiKeyLabel: 'Microsoft Client ID',
    apiKeyHelp: 'Register an app at portal.azure.com',
  },
];

// Storage keys for API keys
const API_KEY_STORAGE = {
  dropbox: 'dropboxAppKey',
  onedrive: 'onedriveClientId',
};

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
  const [isExistingEncryptedFile, setIsExistingEncryptedFile] = useState(false); // true when joining existing sync
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
          // For cloud providers, check if already connected
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

  // Listen for storage changes to trigger auto-sync when content is added/updated
  // This runs in the page context where folder sync can access the File System API
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    
    const handleStorageChange = async (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      // Only trigger on relevant storage changes
      if (areaName !== 'local') return;
      
      // Keys that should trigger a sync
      const syncTriggerKeys = ['archiveItems', 'positions', 'settings', 'customThemes', 'presets'];
      const hasRelevantChange = syncTriggerKeys.some(key => key in changes);
      
      if (!hasRelevantChange) {
        return;
      }
      
      // Check if sync is ready (provider connected)
      const isReady = await syncService.isReadyToSync();
      if (!isReady) {
        return;
      }
      
      // Debounce the sync to avoid too many syncs during rapid changes
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      
      debounceTimer = setTimeout(async () => {
        debounceTimer = null;
        console.log('SyncSettingsSection: Auto-syncing after storage change');
        try {
          await syncService.syncNow();
        } catch (error) {
          console.error('SyncSettingsSection: Auto-sync failed:', error);
        }
      }, 3000); // 3 second debounce
    };
    
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
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

  const handleConnect = useCallback(async (option: ProviderOption) => {
    setPendingProvider(option);
    setError(null);

    // For folder sync, select folder and check for existing files
    if (option.type === 'folder') {
      setIsConnecting(true);
      try {
        await folderAdapter.selectFolder();
        
        // Check if there's an existing sync file and whether it's encrypted
        const remoteState = await syncService.checkRemoteState(folderAdapter);
        
        if (remoteState.exists && remoteState.encrypted) {
          // Found encrypted file - need passphrase
          // Don't clear pendingProvider - we need it for passphrase submit
          syncService.setProvider(folderAdapter);
          setIsConnecting(false);
          setIsExistingEncryptedFile(true); // This is an existing file, not new setup
          setShowPassphraseModal(true);
          return; // Don't run finally cleanup
        }
        
        // No file or unencrypted file - configure without encryption
        syncService.setProvider(folderAdapter);
        await syncService.configureWithoutEncryption(folderAdapter);
        // Trigger initial sync
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

    // For cloud providers, always show API key modal (allows changing existing key)
    if (option.needsApiKey) {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleApiKeySubmit = useCallback(async (apiKey: string) => {
    if (!pendingProvider) return;
    
    setShowApiKeyModal(false);
    
    // Store the API key
    await storeApiKey(pendingProvider.type, apiKey);
    
    // Start OAuth flow with the new key
    await startOAuthFlow(pendingProvider, apiKey);
  }, [pendingProvider]);

  const startOAuthFlow = async (option: ProviderOption, apiKey: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Set the API key on the adapter
      if (option.type === 'dropbox') {
        dropboxAdapter.setAppKey(apiKey);
      } else if (option.type === 'onedrive') {
        oneDriveAdapter.setClientId(apiKey);
      }

      const adapter = option.type === 'dropbox' ? dropboxAdapter : oneDriveAdapter;
      const authUrl = await adapter.startAuth();
      
      // Open auth URL using chrome.identity
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

      // Extract auth code from callback URL
      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');
      
      if (!code) {
        throw new Error('No authorization code received');
      }

      // Complete auth
      await adapter.completeAuth(code);

      // Now prompt for passphrase (cloud sync needs encryption)
      setShowPassphraseModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setPendingProvider(null);
    } finally {
      setIsConnecting(false);
    }
  };

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

      // Trigger initial sync
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
    // Check if passphrase is needed (for encrypted sync - cloud or folder with encrypted file)
    const config = await syncService.getConfig();
    
    if (config?.encryptionEnabled && !syncService.hasPassphrase()) {
      // Need to prompt for passphrase
      const provider = PROVIDER_OPTIONS.find(p => p.type === connectedProvider);
      if (provider) {
        setPendingProvider(provider);
        setShowPassphraseModal(true);
      }
      return;
    }

    // Ensure provider is restored before syncing
    // This handles cases where the page was reloaded and provider wasn't auto-restored
    if (connectedProvider === 'folder') {
      const connected = await folderAdapter.isConnected();
      if (!connected) {
        // Need to re-select folder (permission may have been revoked)
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

  return (
    <div className="settings-group">
      <h3>Cross-Device Sync</h3>
      
      {/* Status indicator */}
      <SyncStatusBadge status={status} />

      {error && (
        <div className="text-red-500 text-sm mt-2 p-2 rounded bg-red-500/10">
          {error}
        </div>
      )}

      {/* Connected state */}
      {connectedProvider ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-current/5">
            <div className="w-10 h-10 rounded-full bg-current/10 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                  d={PROVIDER_OPTIONS.find(p => p.type === connectedProvider)?.icon} />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium">
                {PROVIDER_OPTIONS.find(p => p.type === connectedProvider)?.name}
              </p>
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
        /* Disconnected state - show provider options */
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

      {/* API Key Modal */}
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

      {/* Passphrase Modal */}
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

      {/* Info text */}
      <div className="mt-4 text-xs opacity-50 space-y-1">
        <p>Local folder sync stores data unencrypted for automatic syncing.</p>
        <p>Cloud sync encrypts data with your passphrase for security.</p>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  const getStatusInfo = () => {
    switch (status.state) {
      case 'disabled':
        return { label: 'Not configured', color: 'opacity-50' };
      case 'idle':
        return { label: 'Connected', color: 'text-green-500' };
      case 'syncing':
        return { label: 'Syncing...', color: 'text-blue-500' };
      case 'error':
        return { label: 'Error', color: 'text-red-500' };
      default:
        return { label: 'Unknown', color: 'opacity-50' };
    }
  };

  const { label, color } = getStatusInfo();

  return (
    <div className={`inline-flex items-center gap-1.5 text-sm ${color}`}>
      <span className={`w-2 h-2 rounded-full ${
        status.state === 'syncing' ? 'bg-blue-500 animate-pulse' : 
        status.state === 'idle' ? 'bg-green-500' :
        status.state === 'error' ? 'bg-red-500' : 'bg-current/30'
      }`} />
      {label}
    </div>
  );
}

interface ApiKeyModalProps {
  provider: ProviderOption;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
}

function ApiKeyModal({ provider, onSubmit, onCancel }: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState('');

  // Load existing API key if available
  useEffect(() => {
    const loadExistingKey = async () => {
      const existingKey = await getStoredApiKey(provider.type);
      if (existingKey) {
        setApiKey(existingKey);
      }
    };
    loadExistingKey();
  }, [provider.type]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    onSubmit(apiKey.trim());
  };

  // Get the redirect URI to show user
  const redirectUri = typeof chrome !== 'undefined' && chrome.identity?.getRedirectURL 
    ? chrome.identity.getRedirectURL() 
    : 'https://<extension-id>.chromiumapp.org/';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl p-6 max-w-md w-full shadow-2xl border border-current/20 max-h-[90vh] overflow-y-auto" 
        style={{ backgroundColor: 'var(--bg-color, #1a1a2e)', color: 'var(--text-color, #eaeaea)' }}
      >
        <h3 className="text-lg font-semibold mb-2">
          Configure {provider.name}
        </h3>
        <p className="text-sm opacity-70 mb-4">
          To use {provider.name} sync, you need to provide your own API credentials.
          This keeps your data private and under your control.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 opacity-70">{provider.apiKeyLabel}</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(''); }}
              placeholder={`Enter your ${provider.apiKeyLabel}`}
              autoFocus
              className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent font-mono text-sm"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="p-3 rounded-lg bg-current/5 text-xs space-y-2">
            <p className="font-medium">How to set up your {provider.name} app:</p>
            {provider.type === 'dropbox' && (
              <ol className="list-decimal list-inside space-y-1.5 opacity-70">
                <li>Go to <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">dropbox.com/developers/apps</a></li>
                <li>Click <strong>"Create app"</strong> button (top right)</li>
                <li>Select <strong>"Scoped access"</strong></li>
                <li>Select <strong>"App folder"</strong> (safest option)</li>
                <li>Name your app (e.g., "FlowReader-Sync")</li>
                <li>Click <strong>"Create app"</strong></li>
                <li className="mt-2 pt-2 border-t border-current/10">
                  Go to the <strong>"Permissions"</strong> tab and enable:
                  <ul className="list-disc list-inside ml-4 mt-1">
                    <li><strong>files.metadata.read</strong></li>
                    <li><strong>files.content.write</strong></li>
                    <li><strong>files.content.read</strong></li>
                  </ul>
                  <span className="block mt-1">Click <strong>"Submit"</strong> to save permissions</span>
                </li>
                <li className="mt-2 pt-2 border-t border-current/10">
                  Go to the <strong>"Settings"</strong> tab
                </li>
                <li>Copy the <strong>"App key"</strong></li>
                <li>
                  Scroll to <strong>"OAuth 2 - Redirect URIs"</strong> and add:
                  <div className="mt-1 p-1.5 bg-current/10 rounded font-mono text-[10px] break-all select-all">
                    {redirectUri}
                  </div>
                </li>
              </ol>
            )}
            {provider.type === 'onedrive' && (
              <ol className="list-decimal list-inside space-y-1.5 opacity-70">
                <li>Go to <a href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">Azure App registrations</a></li>
                <li>Click <strong>"New registration"</strong></li>
                <li>Name it (e.g., "FlowReader Sync")</li>
                <li>Under "Supported account types", select <strong>"Personal Microsoft accounts only"</strong></li>
                <li>Under "Redirect URI", select <strong>"Single-page application (SPA)"</strong> and enter:
                  <div className="mt-1 p-1.5 bg-current/10 rounded font-mono text-[10px] break-all select-all">
                    {redirectUri}
                  </div>
                </li>
                <li>Click <strong>"Register"</strong></li>
                <li>Copy the <strong>"Application (client) ID"</strong> from the overview page</li>
              </ol>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-current/20 hover:border-current/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-current/10 hover:bg-current/20 font-medium"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface PassphraseModalProps {
  isNewSetup: boolean;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

function PassphraseModal({ isNewSetup, onSubmit, onCancel }: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [error, setError] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passphrase.length < 8) {
      setError('Passphrase must be at least 8 characters');
      return;
    }

    if (isNewSetup && passphrase !== confirmPassphrase) {
      setError('Passphrases do not match');
      return;
    }

    onSubmit(passphrase);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl p-6 max-w-md w-full shadow-2xl border border-current/20" 
        style={{ backgroundColor: 'var(--bg-color, #1a1a2e)', color: 'var(--text-color, #eaeaea)' }}
      >
        <h3 className="text-lg font-semibold mb-2">
          {isNewSetup ? 'Create Encryption Passphrase' : 'Enter Passphrase'}
        </h3>
        <p className="text-sm opacity-70 mb-4">
          {isNewSetup 
            ? 'Choose a strong passphrase to encrypt your sync data. You will need this passphrase on all your devices.'
            : 'Enter your passphrase to decrypt and sync your data.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1 opacity-70">Passphrase</label>
            <div className="relative">
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={passphrase}
                onChange={(e) => { setPassphrase(e.target.value); setError(''); }}
                placeholder="Enter passphrase"
                autoFocus
                className="w-full px-3 py-2 pr-10 rounded-lg border border-current/20 bg-transparent"
              />
              <button
                type="button"
                onClick={() => setShowPassphrase(!showPassphrase)}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassphrase ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} 
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {isNewSetup && (
            <div>
              <label className="block text-sm mb-1 opacity-70">Confirm Passphrase</label>
              <input
                type={showPassphrase ? 'text' : 'password'}
                value={confirmPassphrase}
                onChange={(e) => { setConfirmPassphrase(e.target.value); setError(''); }}
                placeholder="Confirm passphrase"
                className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent"
              />
            </div>
          )}

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 rounded-lg border border-current/20 hover:border-current/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 rounded-lg bg-current/10 hover:bg-current/20 font-medium"
            >
              {isNewSetup ? 'Create & Connect' : 'Unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

async function getStoredApiKey(provider: SyncProviderType): Promise<string | null> {
  const key = API_KEY_STORAGE[provider as keyof typeof API_KEY_STORAGE];
  if (!key) return null;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] as string || null);
    });
  });
}

async function storeApiKey(provider: SyncProviderType, apiKey: string): Promise<void> {
  const key = API_KEY_STORAGE[provider as keyof typeof API_KEY_STORAGE];
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
