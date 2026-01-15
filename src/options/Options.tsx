import { useEffect, useState, useMemo } from 'react';
import { getSettings, saveSettings, resetSettings, clearStorage } from '@/lib/storage';
import { DEFAULT_SETTINGS, THEME_PRESETS, type ReaderSettings, type ThemePreset } from '@/types';
import { FONT_OPTIONS, THEME_OPTIONS } from '@/constants/ui-options';
import {
  FONT_SIZE, LINE_HEIGHT, COLUMN_WIDTH, WPM, TARGET_WPM, 
  RAMP_STEP, RAMP_INTERVAL, BIONIC_INTENSITY, BIONIC_PROPORTION
} from '@/constants/settings';

export default function Options() {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const isMac = useMemo(() => navigator.platform.toUpperCase().includes('MAC'), []);

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (confirm('Reset all settings to defaults?')) {
      await resetSettings();
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const handleClearData = async () => {
    if (confirm('Clear all data including reading positions and recent documents?')) {
      await clearStorage();
      setSettings(DEFAULT_SETTINGS);
    }
  };

  const applyTheme = (theme: ThemePreset) => {
    const colors = THEME_PRESETS[theme];
    setSettings(prev => ({
      ...prev,
      backgroundColor: colors.backgroundColor,
      textColor: colors.textColor,
      linkColor: colors.linkColor,
      selectionColor: colors.selectionColor,
      highlightColor: colors.highlightColor,
    }));
  };

  const update = (updates: Partial<ReaderSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold">FlowReader Settings</h1>
          <p className="text-gray-600">Customize your reading experience</p>
        </header>

        <Section title="Theme">
          <div className="flex gap-3 flex-wrap">
            {THEME_OPTIONS.map((theme) => (
              <button
                key={theme.value}
                onClick={() => applyTheme(theme.value)}
                className="px-4 py-2 rounded-lg border-2 transition-all"
                style={{
                  backgroundColor: THEME_PRESETS[theme.value].backgroundColor,
                  color: THEME_PRESETS[theme.value].textColor,
                  borderColor:
                    settings.backgroundColor === THEME_PRESETS[theme.value].backgroundColor
                      ? THEME_PRESETS[theme.value].linkColor
                      : 'transparent',
                }}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className="space-y-4">
            <FormSelect
              label="Font Family"
              value={settings.fontFamily}
              options={FONT_OPTIONS}
              onChange={(v) => update({ fontFamily: v })}
            />
            <FormSlider
              label="Font Size"
              value={settings.fontSize}
              {...FONT_SIZE}
              unit="px"
              onChange={(v) => update({ fontSize: v })}
            />
            <FormSlider
              label="Line Height"
              value={settings.lineHeight}
              {...LINE_HEIGHT}
              onChange={(v) => update({ lineHeight: v })}
            />
            <FormSlider
              label="Column Width"
              value={settings.columnWidth}
              {...COLUMN_WIDTH}
              unit="px"
              onChange={(v) => update({ columnWidth: v })}
            />
            <FormCheckbox
              id="hyphenation"
              label="Enable hyphenation"
              checked={settings.hyphenation}
              onChange={(v) => update({ hyphenation: v })}
            />
            <div className="flex items-center gap-3">
              <label className="text-sm">Text Alignment:</label>
              <select
                value={settings.textAlign}
                onChange={(e) => update({ textAlign: e.target.value as 'left' | 'justify' })}
                className="px-3 py-1 border rounded-lg"
              >
                <option value="left">Left</option>
                <option value="justify">Justified</option>
              </select>
            </div>
          </div>
        </Section>

        <Section title="Speed Settings">
          <div className="space-y-4">
            <FormSlider
              label="Default Speed"
              value={settings.baseWPM}
              {...WPM}
              unit=" WPM"
              onChange={(v) => update({ baseWPM: v })}
            />
            <FormCheckbox
              id="rampEnabled"
              label="Enable speed ramp-up"
              checked={settings.rampEnabled}
              onChange={(v) => update({ rampEnabled: v })}
            />
            {settings.rampEnabled && (
              <>
                <FormSlider
                  label="Target Speed"
                  value={settings.targetWPM}
                  {...TARGET_WPM}
                  unit=" WPM"
                  onChange={(v) => update({ targetWPM: v })}
                />
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Increase by {settings.rampStep} WPM every {settings.rampInterval} seconds
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      value={settings.rampStep}
                      onChange={(e) => update({ rampStep: Number(e.target.value) })}
                      className="px-3 py-2 border rounded-lg"
                      min={RAMP_STEP.min}
                      max={RAMP_STEP.max}
                    />
                    <input
                      type="number"
                      value={settings.rampInterval}
                      onChange={(e) => update({ rampInterval: Number(e.target.value) })}
                      className="px-3 py-2 border rounded-lg"
                      min={RAMP_INTERVAL.min}
                      max={RAMP_INTERVAL.max}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        </Section>

        <Section title="Bionic Reading">
          <div className="space-y-4">
            <FormSlider
              label="Intensity"
              value={settings.bionicIntensity}
              {...BIONIC_INTENSITY}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ bionicIntensity: v })}
            />
            <FormSlider
              label="Bold Proportion"
              value={settings.bionicProportion}
              {...BIONIC_PROPORTION}
              formatValue={(v) => `${Math.round(v * 100)}%`}
              onChange={(v) => update({ bionicProportion: v })}
            />
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm" style={{ fontFamily: settings.fontFamily }}>
                <strong>Pre</strong>view: <strong>Thi</strong>s is <strong>ho</strong>w{' '}
                <strong>Bio</strong>nic <strong>Rea</strong>ding <strong>loo</strong>ks{' '}
                <strong>wi</strong>th <strong>yo</strong>ur <strong>set</strong>tings.
              </p>
            </div>
          </div>
        </Section>

        <Section title="Keyboard Shortcuts">
          <div className="space-y-4">
            <ShortcutGroup title="Extension">
              <Shortcut label="Open Reader Mode" keys={isMac ? '⌥+Shift+R' : 'Alt+Shift+R'} />
              <Shortcut label="Open Popup" keys={isMac ? '⌥+Shift+O' : 'Alt+Shift+O'} />
            </ShortcutGroup>
            <p className="text-xs text-gray-400">
              Customize shortcuts at{' '}
              <button
                onClick={() => chrome.tabs.create({ url: 'chrome://extensions/shortcuts' })}
                className="text-blue-500 hover:underline"
              >
                chrome://extensions/shortcuts
              </button>
            </p>
            <ShortcutGroup title="In Reader Mode">
              <Shortcut label="Play / Pause" keys="Space" />
              <Shortcut label="Close Reader" keys="Esc" />
              <Shortcut label="Next (word/sentence/block)" keys="→ or J" />
              <Shortcut label="Previous" keys="← or K" />
              <Shortcut label="Speed +10 WPM" keys="↑" />
              <Shortcut label="Speed -10 WPM" keys="↓" />
              <Shortcut label="Speed ±50 WPM" keys="Shift+↑/↓" />
              <Shortcut label="Cycle Mode" keys="M" />
              <Shortcut label="Toggle Bionic" keys="B" />
              <Shortcut label="Cycle Granularity" keys="G" />
            </ShortcutGroup>
          </div>
        </Section>

        <Section title="Privacy">
          <div className="text-sm text-gray-600 space-y-2">
            <p>FlowReader respects your privacy:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All processing happens locally in your browser</li>
              <li>No data is sent to external servers</li>
              <li>No user accounts or tracking</li>
              <li>Content never leaves your device</li>
              <li>Settings stored locally in Chrome storage</li>
            </ul>
          </div>
        </Section>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset to Defaults
          </button>
          <button
            onClick={handleClearData}
            className="px-6 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            Clear All Data
          </button>
        </div>

        <p className="mt-8 text-sm text-gray-400 text-center">FlowReader v1.0.0</p>
      </div>
    </div>
  );
}

// Local helper components for Options page styling

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      {children}
    </section>
  );
}

interface FormSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  formatValue?: (v: number) => string;
  onChange: (value: number) => void;
}

function FormSlider({ label, value, min, max, step = 1, unit = '', formatValue, onChange }: FormSliderProps) {
  const display = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}: {display}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

interface FormCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function FormCheckbox({ id, label, checked, onChange }: FormCheckboxProps) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id} className="text-sm">{label}</label>
    </div>
  );
}

interface FormSelectProps {
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FormSelect({ label, value, options, onChange }: FormSelectProps) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ShortcutGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-2 text-sm">{children}</div>
    </div>
  );
}

function Shortcut({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <kbd className="px-2 py-0.5 bg-gray-100 rounded text-xs font-mono">{keys}</kbd>
    </div>
  );
}
