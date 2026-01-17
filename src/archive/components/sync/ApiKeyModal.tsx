/**
 * API Key Modal
 * 
 * Modal for entering OAuth API credentials (Dropbox App Key, OneDrive Client ID).
 */

import { useState, useEffect } from 'react';
import type { SyncProviderType } from '@/lib/sync/types';

interface ProviderConfig {
  type: SyncProviderType;
  name: string;
  apiKeyLabel?: string;
}

interface ApiKeyModalProps {
  provider: ProviderConfig;
  onSubmit: (apiKey: string) => void;
  onCancel: () => void;
}

// Storage keys for API keys
const API_KEY_STORAGE: Record<string, string> = {
  dropbox: 'dropboxAppKey',
};

async function getStoredApiKey(provider: SyncProviderType): Promise<string | null> {
  const key = API_KEY_STORAGE[provider];
  if (!key) return null;
  
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] as string || null);
    });
  });
}

export function ApiKeyModal({ provider, onSubmit, onCancel }: ApiKeyModalProps) {
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
