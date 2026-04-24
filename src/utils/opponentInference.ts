import type { Pokemon } from '../api/pokeapi';
import type { Nature, EVSpread } from '../store/teamStore';
import type { MoveData } from './damageCalc';
import { makeSnapshot } from './damageCalc';
import type { PokeSnapshot } from './damageCalc';

export interface InferredOpponent {
  pokemon: Pokemon;
  nature: Nature;
  evs: EVSpread;
  ivs: EVSpread;
  moves: MoveData[];
  role: string;
  snapshot: PokeSnapshot;
}

// ── Competitive move pool ─────────────────────────────────────────────────
// Keyed by type → [physical moves, special moves]
const PHYS: Record<string, MoveData[]> = {
  normal:   [{ name: 'Body Slam',    basePower: 85,  type: 'normal',   category: 'physical' }, { name: 'Facade',       basePower: 70,  type: 'normal',   category: 'physical' }],
  fire:     [{ name: 'Flare Blitz',  basePower: 120, type: 'fire',     category: 'physical' }, { name: 'Fire Punch',   basePower: 75,  type: 'fire',     category: 'physical' }],
  water:    [{ name: 'Liquidation',  basePower: 85,  type: 'water',    category: 'physical' }, { name: 'Waterfall',    basePower: 80,  type: 'water',    category: 'physical' }],
  electric: [{ name: 'Wild Charge',  basePower: 90,  type: 'electric', category: 'physical' }, { name: 'Thunder Punch',basePower: 75,  type: 'electric', category: 'physical' }],
  grass:    [{ name: 'Wood Hammer',  basePower: 120, type: 'grass',    category: 'physical' }, { name: 'Seed Bomb',    basePower: 80,  type: 'grass',    category: 'physical' }],
  ice:      [{ name: 'Icicle Crash', basePower: 85,  type: 'ice',      category: 'physical' }, { name: 'Ice Punch',    basePower: 75,  type: 'ice',      category: 'physical' }],
  fighting: [{ name: 'Close Combat', basePower: 120, type: 'fighting', category: 'physical' }, { name: 'Drain Punch',  basePower: 75,  type: 'fighting', category: 'physical' }],
  poison:   [{ name: 'Poison Jab',   basePower: 80,  type: 'poison',   category: 'physical' }, { name: 'Cross Poison', basePower: 70,  type: 'poison',   category: 'physical' }],
  ground:   [{ name: 'Earthquake',   basePower: 100, type: 'ground',   category: 'physical' }, { name: 'High Horsepower', basePower: 95, type: 'ground', category: 'physical' }],
  flying:   [{ name: 'Brave Bird',   basePower: 120, type: 'flying',   category: 'physical' }, { name: 'Acrobatics',   basePower: 55,  type: 'flying',   category: 'physical' }],
  psychic:  [{ name: 'Zen Headbutt', basePower: 80,  type: 'psychic',  category: 'physical' }, { name: 'Psycho Cut',   basePower: 70,  type: 'psychic',  category: 'physical' }],
  bug:      [{ name: 'U-turn',       basePower: 70,  type: 'bug',      category: 'physical' }, { name: 'X-Scissor',    basePower: 80,  type: 'bug',      category: 'physical' }],
  rock:     [{ name: 'Rock Slide',   basePower: 75,  type: 'rock',     category: 'physical' }, { name: 'Stone Edge',   basePower: 100, type: 'rock',     category: 'physical' }],
  ghost:    [{ name: 'Shadow Claw',  basePower: 70,  type: 'ghost',    category: 'physical' }, { name: 'Phantom Force',basePower: 90,  type: 'ghost',    category: 'physical' }],
  dragon:   [{ name: 'Dragon Claw',  basePower: 80,  type: 'dragon',   category: 'physical' }, { name: 'Outrage',      basePower: 120, type: 'dragon',   category: 'physical' }],
  dark:     [{ name: 'Crunch',       basePower: 80,  type: 'dark',     category: 'physical' }, { name: 'Knock Off',    basePower: 65,  type: 'dark',     category: 'physical' }],
  steel:    [{ name: 'Iron Head',    basePower: 80,  type: 'steel',    category: 'physical' }, { name: 'Meteor Mash',  basePower: 90,  type: 'steel',    category: 'physical' }],
  fairy:    [{ name: 'Play Rough',   basePower: 90,  type: 'fairy',    category: 'physical' }, { name: 'Spirit Break', basePower: 75,  type: 'fairy',    category: 'physical' }],
};

const SPEC: Record<string, MoveData[]> = {
  normal:   [{ name: 'Hyper Voice',    basePower: 90,  type: 'normal',   category: 'special' }, { name: 'Boomburst',     basePower: 140, type: 'normal',   category: 'special' }],
  fire:     [{ name: 'Heat Wave',      basePower: 95,  type: 'fire',     category: 'special' }, { name: 'Fire Blast',    basePower: 110, type: 'fire',     category: 'special' }],
  water:    [{ name: 'Hydro Pump',     basePower: 110, type: 'water',    category: 'special' }, { name: 'Surf',          basePower: 90,  type: 'water',    category: 'special' }],
  electric: [{ name: 'Thunderbolt',    basePower: 90,  type: 'electric', category: 'special' }, { name: 'Thunder',       basePower: 110, type: 'electric', category: 'special' }],
  grass:    [{ name: 'Energy Ball',    basePower: 90,  type: 'grass',    category: 'special' }, { name: 'Leaf Storm',    basePower: 130, type: 'grass',    category: 'special' }],
  ice:      [{ name: 'Ice Beam',       basePower: 90,  type: 'ice',      category: 'special' }, { name: 'Blizzard',      basePower: 110, type: 'ice',      category: 'special' }],
  fighting: [{ name: 'Aura Sphere',    basePower: 80,  type: 'fighting', category: 'special' }, { name: 'Focus Blast',   basePower: 120, type: 'fighting', category: 'special' }],
  poison:   [{ name: 'Sludge Bomb',    basePower: 90,  type: 'poison',   category: 'special' }, { name: 'Sludge Wave',   basePower: 95,  type: 'poison',   category: 'special' }],
  ground:   [{ name: 'Earth Power',    basePower: 90,  type: 'ground',   category: 'special' }, { name: 'Mud Bomb',      basePower: 65,  type: 'ground',   category: 'special' }],
  flying:   [{ name: 'Hurricane',      basePower: 110, type: 'flying',   category: 'special' }, { name: 'Air Slash',     basePower: 75,  type: 'flying',   category: 'special' }],
  psychic:  [{ name: 'Psychic',        basePower: 90,  type: 'psychic',  category: 'special' }, { name: 'Psyshock',      basePower: 80,  type: 'psychic',  category: 'special' }],
  bug:      [{ name: 'Bug Buzz',       basePower: 90,  type: 'bug',      category: 'special' }, { name: 'Pollen Puff',   basePower: 90,  type: 'bug',      category: 'special' }],
  rock:     [{ name: 'Power Gem',      basePower: 80,  type: 'rock',     category: 'special' }, { name: 'Ancient Power', basePower: 60,  type: 'rock',     category: 'special' }],
  ghost:    [{ name: 'Shadow Ball',    basePower: 80,  type: 'ghost',    category: 'special' }, { name: 'Hex',           basePower: 65,  type: 'ghost',    category: 'special' }],
  dragon:   [{ name: 'Draco Meteor',   basePower: 130, type: 'dragon',   category: 'special' }, { name: 'Dragon Pulse',  basePower: 85,  type: 'dragon',   category: 'special' }],
  dark:     [{ name: 'Dark Pulse',     basePower: 80,  type: 'dark',     category: 'special' }, { name: 'Night Daze',    basePower: 85,  type: 'dark',     category: 'special' }],
  steel:    [{ name: 'Flash Cannon',   basePower: 80,  type: 'steel',    category: 'special' }, { name: 'Steel Beam',    basePower: 140, type: 'steel',    category: 'special' }],
  fairy:    [{ name: 'Moonblast',      basePower: 95,  type: 'fairy',    category: 'special' }, { name: 'Dazzling Gleam',basePower: 80,  type: 'fairy',    category: 'special' }],
};

// Common coverage moves that many Pokémon run
const COVERAGE_POOL: MoveData[] = [
  { name: 'Earthquake',     basePower: 100, type: 'ground',   category: 'physical' },
  { name: 'Rock Slide',     basePower: 75,  type: 'rock',     category: 'physical' },
  { name: 'Ice Punch',      basePower: 75,  type: 'ice',      category: 'physical' },
  { name: 'Thunder Punch',  basePower: 75,  type: 'electric', category: 'physical' },
  { name: 'Fire Punch',     basePower: 75,  type: 'fire',     category: 'physical' },
  { name: 'Brick Break',    basePower: 75,  type: 'fighting', category: 'physical' },
  { name: 'Shadow Ball',    basePower: 80,  type: 'ghost',    category: 'special'  },
  { name: 'Energy Ball',    basePower: 90,  type: 'grass',    category: 'special'  },
  { name: 'Ice Beam',       basePower: 90,  type: 'ice',      category: 'special'  },
  { name: 'Thunderbolt',    basePower: 90,  type: 'electric', category: 'special'  },
  { name: 'Dazzling Gleam', basePower: 80,  type: 'fairy',    category: 'special'  },
];

const UTILITY_MOVES: MoveData[] = [
  { name: 'Protect',      basePower: 0, type: 'normal',  category: 'status' },
  { name: 'Tailwind',     basePower: 0, type: 'flying',  category: 'status' },
  { name: 'Trick Room',   basePower: 0, type: 'psychic', category: 'status' },
  { name: 'Follow Me',    basePower: 0, type: 'normal',  category: 'status' },
  { name: 'Helping Hand', basePower: 0, type: 'normal',  category: 'status' },
  { name: 'Fake Out',     basePower: 40, type: 'normal', category: 'physical' },
];

// ── Inference logic ───────────────────────────────────────────────────────

function getStat(pokemon: Pokemon, apiName: string): number {
  return pokemon.stats.find(s => s.name === apiName)?.base ?? 0;
}

function isPhysical(pokemon: Pokemon): boolean {
  return getStat(pokemon, 'attack') > getStat(pokemon, 'special-attack') + 10;
}

function isSpecial(pokemon: Pokemon): boolean {
  return getStat(pokemon, 'special-attack') > getStat(pokemon, 'attack') + 10;
}

function pickNature(pokemon: Pokemon): Nature {
  const spe = getStat(pokemon, 'speed');
  const phys = isPhysical(pokemon);
  const isTrickRoomCandidate = spe <= 60 && (getStat(pokemon, 'attack') >= 100 || getStat(pokemon, 'special-attack') >= 100);

  if (isTrickRoomCandidate) return phys ? 'Brave' : 'Quiet';
  if (spe >= 85) return phys ? 'Jolly' : 'Timid';
  return phys ? 'Adamant' : 'Modest';
}

function pickEVs(pokemon: Pokemon): EVSpread {
  const phys = isPhysical(pokemon);
  const spe = getStat(pokemon, 'speed');
  const hp = getStat(pokemon, 'hp');
  const def = getStat(pokemon, 'defense');
  const spd = getStat(pokemon, 'special-defense');

  // Trick room abuser: invest HP + attack, dump speed
  if (spe <= 60) {
    return phys
      ? { hp: 252, atk: 252, def: 4,   spa: 0, spd: 0, spe: 0 }
      : { hp: 252, atk: 0,   def: 4,   spa: 252, spd: 0, spe: 0 };
  }

  // Bulky attacker: HP investment if high base HP + decent defenses
  const isBulky = hp >= 80 && Math.min(def, spd) >= 70;
  if (isBulky) {
    return phys
      ? { hp: 252, atk: 252, def: 4,   spa: 0, spd: 0, spe: 0 }
      : { hp: 252, atk: 0,   def: 4,   spa: 252, spd: 0, spe: 0 };
  }

  // Standard: max attack + max speed
  return phys
    ? { hp: 4,   atk: 252, def: 0, spa: 0, spd: 0, spe: 252 }
    : { hp: 4,   atk: 0,   def: 0, spa: 252, spd: 0, spe: 252 };
}

function pickMoves(pokemon: Pokemon): MoveData[] {
  const phys = isPhysical(pokemon);
  const spec = isSpecial(pokemon);
  const types = pokemon.types;
  const moves: MoveData[] = [];

  // Primary STAB
  const primary = types[0];
  const primaryPool = phys ? PHYS[primary] : SPEC[primary];
  if (primaryPool?.[0]) moves.push(primaryPool[0]);

  // Secondary STAB
  const secondary = types[1];
  if (secondary) {
    const secPool = phys ? PHYS[secondary] : SPEC[secondary];
    if (secPool?.[0] && !moves.some(m => m.type === secPool[0].type)) moves.push(secPool[0]);
  }

  // Coverage: pick 1 move that hits types not covered by STAB
  const coveredTypes = new Set(moves.map(m => m.type));
  for (const cov of COVERAGE_POOL) {
    if (!coveredTypes.has(cov.type)) {
      // Match category preference
      const isPhysCov = cov.category === 'physical';
      if ((phys && isPhysCov) || (spec && !isPhysCov) || (!phys && !spec)) {
        moves.push(cov);
        break;
      }
    }
  }

  // Utility: Protect for most Pokémon (nearly universal in VGC)
  moves.push(UTILITY_MOVES[0]); // Protect

  return moves.slice(0, 4);
}

const FULL_IVS: EVSpread = { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 };

export function inferOpponent(pokemon: Pokemon): InferredOpponent {
  const nature = pickNature(pokemon);
  const evs    = pickEVs(pokemon);
  const ivs    = FULL_IVS;
  const moves  = pickMoves(pokemon);

  const spe = getStat(pokemon, 'speed');
  let role = 'Sweeper';
  if (spe <= 60) role = 'Trick Room Abuser';
  else if (getStat(pokemon, 'hp') >= 90 && Math.min(getStat(pokemon, 'defense'), getStat(pokemon, 'special-defense')) >= 80) role = 'Bulky Attacker';
  else if (isPhysical(pokemon)) role = 'Physical Sweeper';
  else if (isSpecial(pokemon)) role = 'Special Sweeper';

  const snapshot = makeSnapshot(pokemon.name, pokemon.types, pokemon.stats, nature, evs, ivs);

  return { pokemon, nature, evs, ivs, moves, role, snapshot };
}
