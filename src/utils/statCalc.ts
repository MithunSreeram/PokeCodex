import type { Nature, EVSpread } from '../store/teamStore';

// [boosted stat, lowered stat] — null means neutral
const NATURE_TABLE: Record<Nature, [keyof EVSpread | null, keyof EVSpread | null]> = {
  Hardy:   [null,  null ],
  Lonely:  ['atk', 'def'],
  Brave:   ['atk', 'spe'],
  Adamant: ['atk', 'spa'],
  Naughty: ['atk', 'spd'],
  Bold:    ['def', 'atk'],
  Docile:  [null,  null ],
  Relaxed: ['def', 'spe'],
  Impish:  ['def', 'spa'],
  Lax:     ['def', 'spd'],
  Timid:   ['spe', 'atk'],
  Hasty:   ['spe', 'def'],
  Serious: [null,  null ],
  Jolly:   ['spe', 'spa'],
  Naive:   ['spe', 'spd'],
  Modest:  ['spa', 'atk'],
  Mild:    ['spa', 'def'],
  Quiet:   ['spa', 'spe'],
  Bashful: [null,  null ],
  Rash:    ['spa', 'spd'],
  Calm:    ['spd', 'atk'],
  Gentle:  ['spd', 'def'],
  Sassy:   ['spd', 'spe'],
  Careful: ['spd', 'spa'],
  Quirky:  [null,  null ],
};

export function getNatureEffect(nature: Nature): { up: keyof EVSpread | null; down: keyof EVSpread | null } {
  const [up, down] = NATURE_TABLE[nature];
  return { up, down };
}

export function getNatureModifier(nature: Nature, stat: keyof EVSpread): 1.1 | 1 | 0.9 {
  const [up, down] = NATURE_TABLE[nature];
  if (up === stat) return 1.1;
  if (down === stat) return 0.9;
  return 1;
}

/** Gen 3+ stat formula at the given level (default 50). */
export function calcStat(
  base: number,
  ev: number,
  iv: number,
  nature: Nature,
  stat: keyof EVSpread,
  level = 50,
): number {
  const inner = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (stat === 'hp') return inner + level + 10;
  return Math.floor((inner + 5) * getNatureModifier(nature, stat));
}

/** Maps PokeAPI stat name → EVSpread key */
export const STAT_API_TO_KEY: Record<string, keyof EVSpread> = {
  'hp':              'hp',
  'attack':          'atk',
  'defense':         'def',
  'special-attack':  'spa',
  'special-defense': 'spd',
  'speed':           'spe',
};

/** Ordered stat list for EV/IV grids */
export const STAT_ORDER: Array<{ key: keyof EVSpread; apiName: string; label: string }> = [
  { key: 'hp',  apiName: 'hp',              label: 'HP'  },
  { key: 'atk', apiName: 'attack',          label: 'Atk' },
  { key: 'def', apiName: 'defense',         label: 'Def' },
  { key: 'spa', apiName: 'special-attack',  label: 'SpA' },
  { key: 'spd', apiName: 'special-defense', label: 'SpD' },
  { key: 'spe', apiName: 'speed',           label: 'Spe' },
];

/** Total EV budget (competitive standard) */
export const MAX_TOTAL_EVS = 510;
export const MAX_SINGLE_EV = 252;

export function clampEV(evs: EVSpread, stat: keyof EVSpread, value: number): EVSpread {
  const clamped = Math.max(0, Math.min(MAX_SINGLE_EV, value));
  const without = Object.entries(evs).reduce(
    (sum, [k, v]) => (k === stat ? sum : sum + v),
    0,
  );
  const allowed = Math.min(clamped, MAX_TOTAL_EVS - without);
  return { ...evs, [stat]: allowed };
}
