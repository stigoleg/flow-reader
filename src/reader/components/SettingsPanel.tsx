import { useState, useEffect } from 'react';
import { useReaderStore } from '../store';
import { THEME_PRESETS, type ThemePreset, type ReaderSettings, type ThemeColors } from '@/types';
import { getPresets, savePreset, deletePreset } from '@/lib/storage';
import { useToast } from './Toast';
import {
  ThemeSection,
  PresetSection,
  TypographySection,
  SpeedSection,
  PacingSection,
  BionicSection,
  DisplaySection,
  KeyboardSection,
} from './settings';

export default function SettingsPanel() {
  const { isSettingsOpen, settings, updateSettings, toggleSettings } = useReaderStore();
  const { showToast } = useToast();
  const [presets, setPresets] = useState<Record<string, Partial<ReaderSettings>>>({});

  useEffect(() => {
    if (isSettingsOpen) {
      getPresets().then(setPresets);
    }
  }, [isSettingsOpen]);

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
    showToast(`Preset "${name}" saved`, 'success');
  };

  const handleLoadPreset = (name: string) => {
    const preset = presets[name];
    if (preset) {
      updateSettings(preset);
      showToast(`Preset "${name}" applied`, 'success');
    }
  };

  const handleDeletePreset = async (name: string) => {
    await deletePreset(name);
    setPresets((prev) => {
      const { [name]: _, ...rest } = prev;
      return rest;
    });
    showToast(`Preset "${name}" deleted`, 'info');
  };

  return (
    <>
      {isSettingsOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-90"
          onClick={toggleSettings}
          aria-hidden="true"
        />
      )}

      <aside 
        className={`settings-panel ${isSettingsOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Settings"
        aria-modal={isSettingsOpen}
        inert={!isSettingsOpen ? true : undefined}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold" id="settings-title">Settings</h2>
          <button
            onClick={toggleSettings}
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
        <TypographySection settings={settings} onUpdate={updateSettings} />
        
        {settings.activeMode !== 'bionic' && (
          <SpeedSection settings={settings} onUpdate={updateSettings} />
        )}
        
        {settings.activeMode === 'pacing' && (
          <PacingSection settings={settings} onUpdate={updateSettings} />
        )}
        
        {settings.activeMode === 'bionic' && (
          <BionicSection settings={settings} onUpdate={updateSettings} />
        )}

        <DisplaySection settings={settings} onUpdate={updateSettings} />
        
        <KeyboardSection />
      </aside>
    </>
  );
}
