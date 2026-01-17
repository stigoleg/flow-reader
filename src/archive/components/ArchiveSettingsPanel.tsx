/**
 * Archive Settings Panel
 * 
 * Slide-in settings panel for the Archive page.
 * Focused on theme settings only (no reader-specific options).
 */

import { useState, useEffect } from 'react';
import { THEME_PRESETS, type ThemePreset, type ReaderSettings, type ThemeColors } from '@/types';
import { getPresets, savePreset, deletePreset, saveSettings } from '@/lib/storage';
import { ThemeSection, PresetSection } from '@/reader/components/settings';
import { SyncSettingsSection } from './SyncSettingsSection';

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

  useEffect(() => {
    if (isOpen) {
      getPresets().then(setPresets);
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
