import type { SourceFlag } from '../types';

/**
 * Display-name aliases for sources whose real name is hidden.
 *
 * The stored flags and ids are stable identifiers the data layer keys off, so
 * they are never changed. Only the labels the UI renders are swapped, so no
 * screen in the app names the underlying site.
 */
export const SOURCE_ALIASES: Partial<Record<SourceFlag, string>> = {
  Vega: 'Vega',
  XGroovy: 'Vortex',
  Eporner: 'Aurora',
  EmbedHub: 'Ember',
  RedGifs: 'Flicker',
  Pornhub: 'Nova',
  Xhamster: 'Comet',
  Redtube: 'Crimson',
  JustPorn: 'Quasar',
  HornyFap: 'Nebula',
  YesPorn: 'Zenith',
  XXBrits: 'Pulsar',
  NotFans: 'Onyx',
  PornLib: 'Atlas',
  DrTuber: 'Halo',
  PornGo: 'Prism',
  YouJizz: 'Orbit',
  AnySex: 'Lumen',
  AlotPorn: 'Cinder',
};
