import { useState } from 'react';
import type { ReaderSettings } from '@/types';
import { useToast } from '../Toast';

interface PresetSectionProps {
  presets: Record<string, Partial<ReaderSettings>>;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
}

export function PresetSection({ presets, onSave, onLoad, onDelete }: PresetSectionProps) {
  const [newPresetName, setNewPresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const { showToast } = useToast();

  const handleSave = () => {
    const name = newPresetName.trim();
    if (!name) {
      showToast('Please enter a preset name', 'error');
      return;
    }
    onSave(name);
    setNewPresetName('');
    setShowSaveInput(false);
  };

  const presetNames = Object.keys(presets);

  return (
    <div className="settings-group">
      <h3>Presets</h3>
      <div className="space-y-3">
        {presetNames.length > 0 && (
          <div className="space-y-2">
            {presetNames.map((name) => (
              <div 
                key={name} 
                className="flex items-center gap-2 p-2 rounded-lg border border-current/20 hover:border-current/40 transition-colors"
              >
                <button
                  onClick={() => onLoad(name)}
                  className="flex-1 text-left text-sm truncate"
                  title={`Load "${name}"`}
                >
                  {name}
                </button>
                <button
                  onClick={() => onDelete(name)}
                  className="w-8 h-8 flex items-center justify-center opacity-50 hover:opacity-100 hover:text-red-500 transition-colors"
                  title={`Delete "${name}"`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {showSaveInput ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Preset name..."
              className="flex-1 px-3 py-2 rounded-lg border border-current/20 bg-transparent text-sm"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 hover:bg-current/5 transition-colors"
            >
              Save
            </button>
            <button
              onClick={() => { setShowSaveInput(false); setNewPresetName(''); }}
              className="px-3 py-2 text-sm rounded-lg border border-current/20 hover:border-current/40 transition-colors opacity-60"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSaveInput(true)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-dashed border-current/30 hover:border-current/50 hover:bg-current/5 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            Save current settings as preset
          </button>
        )}

        {presetNames.length === 0 && !showSaveInput && (
          <p className="text-xs opacity-50 text-center py-2">
            No saved presets yet
          </p>
        )}
      </div>
    </div>
  );
}
