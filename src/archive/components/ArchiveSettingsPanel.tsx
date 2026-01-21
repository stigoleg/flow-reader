/**
 * Archive Settings Panel
 * 
 * Slide-in settings panel for the Archive page.
 * Focused on theme settings only (no reader-specific options).
 * Also includes Clear History action (moved from filter bar).
 */

import { useState, useEffect } from 'react';
import { THEME_PRESETS, type ThemePreset, type ReaderSettings, type ThemeColors } from '@/types';
import { getPresets, savePreset, deletePreset, saveSettings } from '@/lib/storage';
import { ThemeSection, PresetSection } from '@/reader/components/settings';
import { SyncSettingsSection } from './SyncSettingsSection';
import { useArchiveStore } from '../store';

interface ArchiveSettingsPanelProps {
  isOpen: boolean;
  settings: ReaderSettings;
  onSettingsChange: (settings: ReaderSettings) => void;
  onClose: () => void;
}

export default function ArchiveSettingsPanel({
  isOpen,
  settings,
  onSettingsChange,
  onClose,
}: ArchiveSettingsPanelProps) {
  const [presets, setPresets] = useState<Record<string, Partial<ReaderSettings>>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  
  const clearHistory = useArchiveStore(state => state.clearHistory);
  const itemCount = useArchiveStore(state => state.items.length);

  useEffect(() => {
    if (isOpen) {
      getPresets().then(setPresets);
    } else {
      // Reset clear confirmation when panel closes
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  const updateSettings = async (changes: Partial<ReaderSettings>) => {
    const newSettings = { ...settings, ...changes };
    onSettingsChange(newSettings);
    await saveSettings(newSettings);
  };

  const applyTheme = (theme: ThemePreset) => {
    const colors = THEME_PRESETS[theme];
    updateSettings({
      backgroundColor: colors.backgroundColor,
      textColor: colors.textColor,
      linkColor: colors.linkColor,
      selectionColor: colors.selectionColor,
      highlightColor: colors.highlightColor,
    });
  };

  const applyCustomTheme = (colors: ThemeColors) => {
    updateSettings({
      backgroundColor: colors.backgroundColor,
      textColor: colors.textColor,
      linkColor: colors.linkColor,
      selectionColor: colors.selectionColor,
      highlightColor: colors.highlightColor,
    });
  };

  const currentColors: ThemeColors = {
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
    linkColor: settings.linkColor,
    selectionColor: settings.selectionColor,
    highlightColor: settings.highlightColor,
  };

  const handleSavePreset = async (name: string) => {
    await savePreset(name, { ...settings });
    setPresets((prev) => ({ ...prev, [name]: { ...settings } }));
  };

  const handleLoadPreset = (name: string) => {
    const preset = presets[name];
    if (preset) {
      updateSettings(preset);
    }
  };

  const handleDeletePreset = async (name: string) => {
    await deletePreset(name);
    setPresets((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-90"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <aside 
        className={`settings-panel ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Settings"
        aria-modal={isOpen}
        inert={!isOpen ? true : undefined}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" id="settings-title">Settings</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded opacity-60 hover:opacity-100 md:w-8 md:h-8"
            aria-label="Close settings"
          >
            <svg className="w-6 h-6 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <ThemeSection 
          currentColors={currentColors}
          onApplyTheme={applyTheme} 
          onApplyCustomTheme={applyCustomTheme}
        />
        <PresetSection
          presets={presets}
          onSave={handleSavePreset}
          onLoad={handleLoadPreset}
          onDelete={handleDeletePreset}
        />
        <SyncSettingsSection />

        {/* Data section with Clear History */}
        <div className="settings-group mt-6">
          <h3>Data</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Clear History</p>
                <p className="text-xs opacity-60">
                  Remove all {itemCount} items from your archive
                </p>
              </div>
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  disabled={itemCount === 0}
                  className="px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    color: '#dc2626',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                  }}
                >
                  Clear...
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="px-3 py-1.5 text-sm rounded-lg transition-colors"
                    style={{ backgroundColor: 'rgba(128, 128, 128, 0.1)' }}
                    disabled={isClearing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsClearing(true);
                      try {
                        await clearHistory();
                        setShowClearConfirm(false);
                      } finally {
                        setIsClearing(false);
                      }
                    }}
                    disabled={isClearing}
                    className="px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-60"
                    style={{
                      backgroundColor: '#dc2626',
                      color: 'white',
                    }}
                  >
                    {isClearing ? 'Clearing...' : 'Confirm'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* About section */}
        <div className="settings-group mt-8">
          <h3>About</h3>
          <p className="text-sm opacity-70">
            FlowReader helps you read faster with pacing aids and bionic reading.
          </p>
          <p className="text-xs opacity-50 mt-2">
            Theme settings here are shared with the reader.
          </p>
        </div>
      </aside>
    </>
  );
}
