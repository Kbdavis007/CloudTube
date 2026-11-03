import React, { useEffect, useState } from 'react';
import { Search, Check, RotateCcw, KeyRound } from 'lucide-react';
import { OPEN_SOURCES, type OpenSourceId } from '../services/openSourcesApi';
import {
  readEnabledOpenSources,
  saveEnabledOpenSources,
  subscribeSearchSources,
  allOpenSourceIds,
} from '../services/searchSources';
import { readRapidApiKey, saveRapidApiKey, subscribeRapidApiKey } from '../services/rapidApiKey';

export interface SearchSourcesPanelProps {
  /** Collapsed by default, matching the other Settings panels. */
  defaultExpanded?: boolean;
}

/**
 * Settings panel that picks which key-free sources a search runs against. The
 * selection is saved immediately (no Apply step) and broadcast, so the Search
 * page reflects it without a reload.
 */
export const SearchSourcesPanel: React.FC<SearchSourcesPanelProps> = ({
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [enabled, setEnabled] = useState<Set<OpenSourceId>>(
    () => new Set(readEnabledOpenSources())
  );
  const [rapidApiKey, setRapidApiKey] = useState(() => readRapidApiKey());

  // Keep the panel in sync if another view changes the set.
  useEffect(() => subscribeSearchSources((ids) => setEnabled(new Set(ids))), []);
  useEffect(() => subscribeRapidApiKey(setRapidApiKey), []);

  const toggle = (id: OpenSourceId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveEnabledOpenSources([...next]);
      return next;
    });
  };

  const resetAll = () => {
    const all = allOpenSourceIds();
    saveEnabledOpenSources(all);
    setEnabled(new Set(all));
  };

  const enabledCount = OPEN_SOURCES.filter((s) => enabled.has(s.id)).length;

  return (
    <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-white">Search Sources</h2>
          <span className="text-[10px] font-mono text-slate-500">
            {enabledCount}/{OPEN_SOURCES.length} enabled
          </span>
        </div>

        <button
          onClick={() => setIsExpanded((v) => !v)}
          aria-expanded={isExpanded}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition active:scale-95"
        >
          <Search className="w-3.5 h-3.5" />
          <span>{isExpanded ? 'Hide Sources' : 'Choose Sources'}</span>
        </button>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        Pick which catalogues a search should include. Only the checked sources are
        queried — YouTube search is unaffected. Results play inside the app.
      </p>

      {isExpanded && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {OPEN_SOURCES.map((source) => {
              const checked = enabled.has(source.id);
              return (
                <button
                  key={source.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggle(source.id)}
                  className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition active:scale-[0.99] ${
                    checked
                      ? 'bg-orange-500/10 border-orange-500/50 ring-1 ring-orange-500/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                      checked
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-slate-900 border-slate-600'
                    }`}
                  >
                    {checked && <Check className="w-3 h-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{source.name}</span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${source.accent}`}
                      >
                        {source.name}
                      </span>
                      {source.requiresKey && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-300">
                          key
                        </span>
                      )}
                    </span>
                    <span className="block mt-1 text-[11px] text-slate-400 leading-snug">
                      {source.tagline}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
            <label
              htmlFor="rapidapi-key"
              className="flex items-center gap-2 text-xs font-bold text-white"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              RapidAPI key
              <span className="text-[10px] font-normal text-slate-500">
                for the key-based adult sources
              </span>
            </label>
            <input
              id="rapidapi-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={rapidApiKey}
              onChange={(e) => {
                setRapidApiKey(e.target.value);
                saveRapidApiKey(e.target.value);
              }}
              placeholder="x-rapidapi-key from your RapidAPI app"
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono placeholder:text-slate-600 focus:outline-none focus:border-amber-500/60"
            />
            <p className="text-[11px] text-slate-400 leading-snug">
              One key covers every RapidAPI source. Stored only on this device and sent straight
              to RapidAPI. Leave blank to disable those sources.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              {enabledCount === 0
                ? 'No open sources selected — searches will only cover YouTube.'
                : 'Saved to this device.'}
            </span>
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[11px] font-semibold transition active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Enable All</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
