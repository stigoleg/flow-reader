import { useState, useEffect, useRef } from 'react';
import { THEME_PRESETS, type ThemePreset, type ThemeColors, type CustomTheme, type ThemeExport } from '@/types';
import { THEME_OPTIONS } from '@/constants/ui-options';
import { getCustomThemes, saveCustomTheme, deleteCustomTheme } from '@/lib/storage';

interface ThemeSectionProps {
  currentColors: ThemeColors;
  onApplyTheme: (theme: ThemePreset) => void;
  onApplyCustomTheme: (colors: ThemeColors) => void;
}

export function ThemeSection({ currentColors, onApplyTheme, onApplyCustomTheme }: ThemeSectionProps) {
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<CustomTheme | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCustomThemes();
  }, []);

  const loadCustomThemes = async () => {
    const themes = await getCustomThemes();
    setCustomThemes(themes);
  };

  const handleCreateNew = () => {
    setEditingTheme({
      name: '',
      ...currentColors,
    });
    setIsEditorOpen(true);
  };

  const handleEditCustom = (theme: CustomTheme) => {
    setEditingTheme({ ...theme });
    setIsEditorOpen(true);
  };

  const handleSaveTheme = async (theme: CustomTheme) => {
    await saveCustomTheme(theme);
    await loadCustomThemes();
    setIsEditorOpen(false);
    setEditingTheme(null);
    onApplyCustomTheme(theme);
  };

  const handleDeleteTheme = async (name: string) => {
    await deleteCustomTheme(name);
    await loadCustomThemes();
  };

  const handleExportTheme = (theme: CustomTheme) => {
    const exportData: ThemeExport = {
      version: 1,
      theme,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.name.toLowerCase().replace(/\s+/g, '-')}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ThemeExport;
      
      if (data.version !== 1 || !data.theme || !data.theme.name) {
        alert('Invalid theme file format');
        return;
      }

      // Validate required color fields
      const required: (keyof ThemeColors)[] = ['backgroundColor', 'textColor', 'linkColor', 'selectionColor', 'highlightColor'];
      for (const field of required) {
        if (!data.theme[field]) {
          alert(`Invalid theme: missing ${field}`);
          return;
        }
      }

      await saveCustomTheme(data.theme);
      await loadCustomThemes();
      onApplyCustomTheme(data.theme);
    } catch {
      alert('Failed to import theme. Please check the file format.');
    }

    // Reset input
    e.target.value = '';
  };

  return (
    <div className="settings-group">
      <h3>Theme</h3>
      
      {/* Built-in themes */}
      <div className="flex gap-2 flex-wrap mb-4">
        {THEME_OPTIONS.map((theme) => (
          <ThemeButton 
            key={theme.value} 
            colors={THEME_PRESETS[theme.value]} 
            label={theme.label} 
            onClick={() => onApplyTheme(theme.value)} 
          />
        ))}
      </div>

      {/* Custom themes */}
      {customThemes.length > 0 && (
        <div className="mb-4">
          <p className="text-xs opacity-50 mb-2">Custom</p>
          <div className="flex gap-2 flex-wrap">
            {customThemes.map((theme) => (
              <div key={theme.name} className="relative group">
                <ThemeButton
                  colors={theme}
                  label={theme.name}
                  onClick={() => onApplyCustomTheme(theme)}
                />
                <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditCustom(theme); }}
                    className="w-5 h-5 rounded-full bg-current/20 hover:bg-current/40 flex items-center justify-center text-[10px]"
                    title="Edit"
                  >
                    E
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleExportTheme(theme); }}
                    className="w-5 h-5 rounded-full bg-current/20 hover:bg-current/40 flex items-center justify-center text-[10px]"
                    title="Export"
                  >
                    S
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteTheme(theme.name); }}
                    className="w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-500 flex items-center justify-center text-[10px]"
                    title="Delete"
                  >
                    X
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCreateNew}
          className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 transition-colors"
        >
          + Create Theme
        </button>
        <button
          onClick={handleImportClick}
          className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 transition-colors"
        >
          Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImportFile}
          className="hidden"
        />
      </div>

      {/* Theme Editor Modal */}
      {isEditorOpen && editingTheme && (
        <ThemeEditor
          theme={editingTheme}
          onSave={handleSaveTheme}
          onCancel={() => { setIsEditorOpen(false); setEditingTheme(null); }}
          existingNames={customThemes.map(t => t.name)}
        />
      )}
    </div>
  );
}

interface ThemeButtonProps {
  colors: ThemeColors;
  label: string;
  onClick: () => void;
}

function ThemeButton({ colors, label, onClick }: ThemeButtonProps) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 transition-colors min-h-[44px] md:py-1.5 md:min-h-0"
      style={{
        backgroundColor: colors.backgroundColor,
        color: colors.textColor,
      }}
    >
      {label}
    </button>
  );
}

interface ThemeEditorProps {
  theme: CustomTheme;
  onSave: (theme: CustomTheme) => void;
  onCancel: () => void;
  existingNames: string[];
}

function ThemeEditor({ theme, onSave, onCancel, existingNames }: ThemeEditorProps) {
  const [name, setName] = useState(theme.name);
  const [colors, setColors] = useState<ThemeColors>({
    backgroundColor: theme.backgroundColor,
    textColor: theme.textColor,
    linkColor: theme.linkColor,
    selectionColor: theme.selectionColor,
    highlightColor: theme.highlightColor,
  });
  const [error, setError] = useState('');

  const isEditing = theme.name !== '';

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }
    if (!isEditing && existingNames.includes(trimmedName)) {
      setError('A theme with this name already exists');
      return;
    }
    onSave({ name: trimmedName, ...colors });
  };

  const colorFields: { key: keyof ThemeColors; label: string }[] = [
    { key: 'backgroundColor', label: 'Background' },
    { key: 'textColor', label: 'Text' },
    { key: 'linkColor', label: 'Links' },
    { key: 'selectionColor', label: 'Selection' },
    { key: 'highlightColor', label: 'Highlight' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        style={{ backgroundColor: colors.backgroundColor, color: colors.textColor }}
      >
        <h3 className="text-lg font-semibold mb-4">
          {isEditing ? 'Edit Theme' : 'Create Theme'}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm mb-1 opacity-70">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(''); }}
              disabled={isEditing}
              placeholder="My Theme"
              className="w-full px-3 py-2 rounded-lg border border-current/20 bg-transparent disabled:opacity-50"
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          {/* Color pickers */}
          {colorFields.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm mb-1 opacity-70">{label}</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={colors[key].slice(0, 7)} // Handle alpha colors
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  className="w-10 h-10 rounded cursor-pointer border border-current/20"
                />
                <input
                  type="text"
                  value={colors[key]}
                  onChange={(e) => setColors({ ...colors, [key]: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-current/20 bg-transparent font-mono text-sm"
                  placeholder="#000000"
                />
              </div>
            </div>
          ))}

          {/* Preview */}
          <div className="mt-4 p-4 rounded-lg border border-current/20">
            <p className="text-sm opacity-70 mb-2">Preview</p>
            <p style={{ color: colors.textColor }}>
              Regular text with <a href="#" style={{ color: colors.linkColor }}>a link</a> and 
              <span style={{ backgroundColor: colors.highlightColor, padding: '0 4px', borderRadius: '2px' }}> highlighted word</span>.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded-lg border border-current/20 hover:border-current/40"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 rounded-lg border border-current/40 hover:bg-current/10"
            style={{ backgroundColor: colors.linkColor, color: colors.backgroundColor }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
