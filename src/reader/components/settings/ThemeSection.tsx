import { THEME_PRESETS, type ThemePreset } from '@/types';
import { THEME_OPTIONS } from '@/constants/ui-options';

interface ThemeSectionProps {
  onApplyTheme: (theme: ThemePreset) => void;
}

export function ThemeSection({ onApplyTheme }: ThemeSectionProps) {
  const standardThemes = THEME_OPTIONS.filter(t => t.category === 'standard');
  const eyeFriendlyThemes = THEME_OPTIONS.filter(t => t.category === 'eye-friendly');

  return (
    <div className="settings-group">
      <h3>Theme</h3>
      <div className="space-y-3">
        <div>
          <p className="text-xs opacity-50 mb-2">Standard</p>
          <div className="flex gap-2 flex-wrap">
            {standardThemes.map((theme) => (
              <ThemeButton key={theme.value} theme={theme.value} label={theme.label} onClick={onApplyTheme} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs opacity-50 mb-2">Eye-Friendly</p>
          <div className="flex gap-2 flex-wrap">
            {eyeFriendlyThemes.map((theme) => (
              <ThemeButton key={theme.value} theme={theme.value} label={theme.label} onClick={onApplyTheme} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ThemeButtonProps {
  theme: ThemePreset;
  label: string;
  onClick: (theme: ThemePreset) => void;
}

function ThemeButton({ theme, label, onClick }: ThemeButtonProps) {
  const colors = THEME_PRESETS[theme];
  return (
    <button
      onClick={() => onClick(theme)}
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
