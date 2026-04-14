import type { Pokemon } from '../api/pokeapi';
import type { VGCRole } from '../store/teamStore';

// ── Move pools that unlock specific roles ─────────────────────────────────
const FAKE_OUT_POOL    = new Set(['fake-out']);
const TAILWIND_POOL    = new Set(['tailwind']);
const TRICK_ROOM_POOL  = new Set(['trick-room']);
const REDIRECT_POOL    = new Set(['follow-me', 'rage-powder']);
const PIVOT_POOL       = new Set(['u-turn', 'volt-switch', 'flip-turn', 'baton-pass', 'teleport']);
const TERRAIN_POOL     = new Set(['electric-terrain', 'grassy-terrain', 'misty-terrain', 'psychic-terrain']);
const WEATHER_POOL     = new Set(['rain-dance', 'sunny-day', 'sandstorm', 'snowscape', 'hail', 'chilly-reception']);
const SPEED_CTRL_POOL  = new Set([
  'tailwind', 'trick-room', 'icy-wind', 'electroweb', 'scary-face',
  'thunder-wave', 'sticky-web', 'glaciate', 'bulldoze', 'string-shot',
]);
const SUPPORT_POOL     = new Set([
  'helping-hand', 'wide-guard', 'quick-guard', 'protect', 'safeguard',
  'crafty-shield', 'reflect', 'light-screen', 'aurora-veil', 'ally-switch',
  'after-you', 'instruct',
]);

// VGC 2025 Series 2 restricted legendaries (PokeAPI slugs)
const VGC_RESTRICTED = new Set([
  'mewtwo',
  'lugia', 'ho-oh',
  'kyogre', 'groudon', 'rayquaza',
  'dialga', 'dialga-origin', 'palkia', 'palkia-origin',
  'giratina', 'giratina-origin',
  'reshiram', 'zekrom', 'kyurem', 'kyurem-black', 'kyurem-white',
  'xerneas', 'yveltal', 'zygarde', 'zygarde-10',
  'solgaleo', 'lunala', 'necrozma', 'necrozma-dusk-mane', 'necrozma-dawn-wings',
  'zacian', 'zacian-crowned', 'zamazenta', 'zamazenta-crowned', 'eternatus',
  'calyrex', 'calyrex-ice', 'calyrex-shadow',
  'koraidon', 'miraidon',
  'terapagos', 'pecharunt',
]);

function hasAny(pool: Set<string>, moveNames: Set<string>) {
  for (const m of pool) if (moveNames.has(m)) return true;
  return false;
}

/**
 * Returns all roles this Pokémon is capable of filling,
 * based on its move pool and base stats.
 */
export function getEligibleRoles(pokemon: Pokemon): VGCRole[] {
  const moveNames = new Set(pokemon.moves.map(m => m.name));

  const hp  = pokemon.stats.find(s => s.name === 'hp')?.base ?? 0;
  const atk = pokemon.stats.find(s => s.name === 'attack')?.base ?? 0;
  const def = pokemon.stats.find(s => s.name === 'defense')?.base ?? 0;
  const spa = pokemon.stats.find(s => s.name === 'special-attack')?.base ?? 0;
  const spd = pokemon.stats.find(s => s.name === 'special-defense')?.base ?? 0;
  const spe = pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;

  const eligible: VGCRole[] = [];

  if (VGC_RESTRICTED.has(pokemon.name))       eligible.push('Restricted');
  if (hasAny(FAKE_OUT_POOL, moveNames))        eligible.push('Fake Out');
  if (hasAny(TAILWIND_POOL, moveNames))        eligible.push('Tailwind Setter');
  if (hasAny(TRICK_ROOM_POOL, moveNames))      eligible.push('Trick Room Setter');
  if (hasAny(REDIRECT_POOL, moveNames))        eligible.push('Redirector');
  if (hasAny(PIVOT_POOL, moveNames))           eligible.push('Pivot');
  if (hasAny(TERRAIN_POOL, moveNames))         eligible.push('Terrain Setter');
  if (hasAny(WEATHER_POOL, moveNames))         eligible.push('Weather Setter');
  if (hasAny(SPEED_CTRL_POOL, moveNames))      eligible.push('Speed Control');
  if (hasAny(SUPPORT_POOL, moveNames))         eligible.push('Support');

  // Stat thresholds for generic roles
  if (Math.max(atk, spa) >= 95 && spe >= 75)  eligible.push('Sweeper');
  if (hp >= 70 && Math.min(def, spd) >= 80)   eligible.push('Wall');

  return eligible;
}

/**
 * Best single suggested role for a newly-added team member.
 * Falls back to 'Sweeper' if nothing specific fits.
 */
export function suggestPrimaryRole(pokemon: Pokemon): VGCRole {
  const eligible = getEligibleRoles(pokemon);
  const priority: VGCRole[] = [
    'Restricted', 'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
    'Redirector', 'Sweeper', 'Pivot', 'Speed Control',
    'Terrain Setter', 'Weather Setter', 'Wall', 'Support',
  ];
  return priority.find(r => eligible.includes(r)) ?? 'Sweeper';
}

/** All VGC roles in display order. */
export const ALL_ROLES: VGCRole[] = [
  'Restricted', 'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
  'Redirector', 'Terrain Setter', 'Weather Setter', 'Sweeper',
  'Pivot', 'Support', 'Wall', 'Speed Control',
];
