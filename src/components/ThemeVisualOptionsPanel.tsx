import React, { useState } from 'react';
import { Palette, Sun, Moon, Contrast, Check, Sparkles } from 'lucide-react';
import { THEME_OPTIONS, readStoredTheme, saveTheme, type ThemeMode } from '../services/theme';

const MODE_ICONS: Record<ThemeMode, React.ReactNode> = {
  light: <Sun className="w-3.5 h-3.5" />,
  medium: <Contrast className="w-3.5 h-3.5" />,
  dark: <Moon className="w-3.5 h-3.5" />,
};

/** Miniature mock of the app so each mode's palette is visible at a glance. */
const ThemePreview: React.FC<{ option: (typeof THEME_OPTIONS)[number] }> = ({ option }) => {
  const { page, panel, border, text, accent } = option.preview;

  return (
    <div
      className="w-full h-16 rounded-lg overflow-hidden flex gap-1 p-1.5"
      style={{ backgroundColor: page, border: `1px solid ${border}` }}
      aria-hidden="true"
    >
      {/* Sidebar rail */}
      <div className="w-3 rounded-sm flex flex-col gap-1 p-0.5" style={{ backgroundColor: panel }}>
        <span className="w-full h-1 rounded-full" style={{ backgroundColor: accent }} />
        <span className="w-full h-1 rounded-full" style={{ backgroundColor: border }} />
        <span className="w-full h-1 rounded-full" style={{ backgroundColor: border }} />
      </div>
      {/* Content */}
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-2.5 rounded-sm" style={{ backgroundColor: panel }} />
        <div className="flex-1 rounded-sm flex items-center gap-1 px-1" style={{ backgroundColor: panel }}>
          <span className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: text, opacity: 0.7 }} />
          <span className="h-2 w-4 rounded-sm" style={{ backgroundColor: accent }} />
        </div>
      </div>
    </div>
  );
};

export interface ThemeVisualOptionsPanelProps {
  /** Collapsed by default, matching the Video Sources panel. */
  defaultExpanded?: boolean;
}

/**
 * Theme & Visual Options panel for the Settings page. Selection is staged
 * locally and only committed on "Apply Theme", so a mis-click does not repaint
 * the app.
 */
export const ThemeVisualOptionsPanel: React.FC<ThemeVisualOptionsPanelProps> = ({
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [applied, setApplied] = useState<ThemeMode>(() => readStoredTheme());
  const [pending, setPending] = useState<ThemeMode>(() => readStoredTheme());

  const isDirty = pending !== applied;

  const handleApply = () => {
    saveTheme(pending);
    setApplied(pending);
  };

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">Theme &amp; Visual Options</h2>
          <span className="text-[10px] font-mono text-slate-500">
            {THEME_OPTIONS.find((o) => o.id === applied)?.label} active
          </span>
        </div>

        <button
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition active:scale-95"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>{isExpanded ? 'Hide Options' : 'Manage Theme'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Choose how CloudTube looks. Dark is the default; Medium sits between Light and Dark with
        slate-gray surfaces and softer orange accents.
      </p>

      {isExpanded && (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Theme mode" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {THEME_OPTIONS.map((option) => {
              const selected = pending === option.id;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPending(option.id)}
                  className={`text-left p-3 rounded-2xl border transition active:scale-[0.98] ${
                    selected
                      ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/40'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <ThemePreview option={option} />

                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span className={selected ? 'text-orange-400' : 'text-slate-400'}>
                      {MODE_ICONS[option.id]}
                    </span>
                    <span className="text-xs font-bold text-white">{option.label}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-orange-400 ml-auto" />}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400 leading-snug">{option.description}</p>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              {isDirty ? 'Unsaved change — apply to keep it.' : 'Saved to this device.'}
            </span>
            <button
              onClick={handleApply}
              disabled={!isDirty}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-bold transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apply Theme</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
