import type { SourceFlag } from '../types';

/**
 * Display-name aliases for adult sources.
 *
 * The stored flags and ids are stable identifiers the data layer keys off, so
 * they are never changed. Only the labels the UI renders are swapped, so no
 * screen in the app names the underlying site.
 */
export const ADULT_SOURCE_ALIASES: Partial<Record<SourceFlag, string>> = {
  Xvideos: 'Vista',
  Eporner: 'Aurora',
  AdultEmbed: 'Ember',
  RedGifs: 'Flicker',
  Pornhub: 'Nova',
  Xhamster: 'Comet',
  Redtube: 'Crimson',
};
