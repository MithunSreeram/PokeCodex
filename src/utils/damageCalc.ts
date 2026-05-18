import { calcStat } from './statCalc';
import { getEffectiveness } from './typeChart';
import type { Nature, EVSpread } from '../store/teamStore';

export interface MoveData {
  name: string;
  basePower: number;
  type: string;
  category: 'physical' | 'special' | 'status';
}

export interface PokeSnapshot {
  name: string;
  types: string[];
  nature: Nature;
  evs: EVSpread;
  ivs: EVSpread;
  baseAtk: number;
  baseDef: number;
  baseSpa: number;
  baseSpd: number;
  baseSpe: number;
  baseHp:  number;
}

export interface DamageResult {
  min: number;       // damage at the 0.85 roll
  max: number;       // damage at the 1.00 roll
  minPct: number;    // % of defender HP at min roll
  maxPct: number;    // % of defender HP at max roll
  rolls: number[];   // all 16 damage values (index 0 = 85%, index 15 = 100%)
  koPct: number;     // % of rolls (0-100) that exactly OHKO
  effectiveness: number;
  stab: boolean;
  category: 'physical' | 'special' | 'status';
}

/** Per-Pokémon in-battle stat stage modifiers (-6 to +6). */
export interface StatStages {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number; // tracked for display; not used in damage formula
}

/** Stat-stage multiplier: (2+s)/2 for s≥0, 2/(2-s) for s<0. */
function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export type Weather =
  | 'none'
  | 'sun'        // Harsh Sunlight: fire ×1.5, water ×0.5
  | 'rain'       // Rain: water ×1.5, fire ×0.5
  | 'sand'       // Sandstorm: rock SpD ×1.5
  | 'snow'       // Snow: ice Def ×1.5
  | 'extremesun' // Desolate Land: fire ×1.5, water nullified
  | 'heavyrain'; // Primordial Sea: water ×1.5, fire nullified

export type Terrain = 'none' | 'electric' | 'grassy' | 'psychic' | 'misty';

/** Items that multiply attacker damage. */
export type AttackerItem =
  | 'none'
  | 'life-orb'     // ×1.3 all moves
  | 'choice-band'  // ×1.5 physical
  | 'choice-specs' // ×1.5 special
  | 'muscle-band'  // ×1.1 physical
  | 'wise-glasses' // ×1.1 special
  | 'expert-belt'; // ×1.2 if super-effective

export interface CalcOptions {
  terrain?: Terrain;
  isCrit?: boolean;         // ×1.5, bypasses screens + positive def stages
  isBurned?: boolean;       // attacker burned → physical Atk ×0.5
  isSpread?: boolean;       // doubles spread move → ×0.75
  isHelpingHand?: boolean;  // partner Helping Hand → ×1.5
  reflect?: boolean;        // halves physical damage (bypassed by crit)
  lightScreen?: boolean;    // halves special damage (bypassed by crit)
  auroraVeil?: boolean;     // halves all damage (bypassed by crit)
  attackerItem?: AttackerItem;
  isDoubles?: boolean;
}

/** Offensive modifier applied to a move's damage by the current weather. */
export function weatherMoveMod(weather: Weather, moveType: string): number {
  switch (weather) {
    case 'sun':
      if (moveType === 'fire')  return 1.5;
      if (moveType === 'water') return 0.5;
      break;
    case 'extremesun':
      if (moveType === 'fire')  return 1.5;
      if (moveType === 'water') return 0; // nullified
      break;
    case 'rain':
      if (moveType === 'water') return 1.5;
      if (moveType === 'fire')  return 0.5;
      break;
    case 'heavyrain':
      if (moveType === 'water') return 1.5;
      if (moveType === 'fire')  return 0; // nullified
      break;
  }
  return 1;
}

/** Defensive stat multiplier granted by weather to the defender. */
function weatherDefMod(weather: Weather, defTypes: string[], statKey: 'def' | 'spd'): number {
  if (weather === 'sand' && statKey === 'spd' && defTypes.includes('rock')) return 1.5;
  if (weather === 'snow' && statKey === 'def' && defTypes.includes('ice'))  return 1.5;
  return 1;
}

/**
 * Terrain move modifier. Flying-type Pokémon are not grounded and ignore
 * terrain boosts/penalties (simplified: no Levitate/Magnet Rise tracking).
 */
export function terrainMoveMod(
  terrain: Terrain,
  moveType: string,
  moveName: string,
  attackerTypes: string[],
  defenderTypes: string[],
): number {
  const atkGrounded = !attackerTypes.includes('flying');
  const defGrounded = !defenderTypes.includes('flying');
  switch (terrain) {
    case 'electric':
      if (moveType === 'electric' && atkGrounded) return 1.3;
      break;
    case 'grassy':
      if (moveType === 'grass' && atkGrounded) return 1.3;
      if (['earthquake', 'bulldoze', 'magnitude'].includes(moveName) && defGrounded) return 0.5;
      break;
    case 'psychic':
      if (moveType === 'psychic' && atkGrounded) return 1.3;
      break;
    case 'misty':
      if (moveType === 'dragon' && defGrounded) return 0.5;
      break;
  }
  return 1;
}

/** Item multiplier for the attacker. */
function itemMod(item: AttackerItem, category: MoveData['category'], effectiveness: number): number {
  switch (item) {
    case 'life-orb':     return 1.3;
    case 'choice-band':  return category === 'physical' ? 1.5 : 1;
    case 'choice-specs': return category === 'special'  ? 1.5 : 1;
    case 'muscle-band':  return category === 'physical' ? 1.1 : 1;
    case 'wise-glasses': return category === 'special'  ? 1.1 : 1;
    case 'expert-belt':  return effectiveness > 1       ? 1.2 : 1;
    default:             return 1;
  }
}

const ZERO_RESULT = (eff: number, cat: MoveData['category']): DamageResult => ({
  min: 0, max: 0, minPct: 0, maxPct: 0, rolls: Array(16).fill(0), koPct: 0,
  effectiveness: eff, stab: false, category: cat,
});

/** Gen 8/9 damage formula at Lv 50. Returns all 16 rolls, min/max and KO%. */
export function calcDamage(
  attacker: PokeSnapshot,
  move: MoveData,
  defender: PokeSnapshot,
  weather: Weather = 'none',
  attackerStages: Partial<StatStages> = {},
  defenderStages: Partial<StatStages> = {},
  options: CalcOptions = {},
): DamageResult {
  if (move.category === 'status' || move.basePower <= 0) {
    return ZERO_RESULT(1, move.category);
  }

  const {
    terrain = 'none',
    isCrit = false,
    isBurned = false,
    isSpread = false,
    isHelpingHand = false,
    reflect = false,
    lightScreen = false,
    auroraVeil = false,
    attackerItem = 'none',
    isDoubles = false,
  } = options;

  const moveMod = weatherMoveMod(weather, move.type);
  if (moveMod === 0) {
    return ZERO_RESULT(getEffectiveness(move.type, defender.types), move.category);
  }

  const atkKey = move.category === 'physical' ? 'atk' : 'spa';
  const defKey = move.category === 'physical' ? 'def' : 'spd';
  const atkBase = move.category === 'physical' ? attacker.baseAtk : attacker.baseSpa;
  const defBase = move.category === 'physical' ? defender.baseDef : defender.baseSpd;

  // Attacker stat — crits ignore negative stages
  const atkStatBase = calcStat(atkBase, attacker.evs[atkKey], attacker.ivs[atkKey], attacker.nature, atkKey);
  const atkStageRaw = atkKey === 'atk' ? (attackerStages.atk ?? 0) : (attackerStages.spa ?? 0);
  const atkStageEff = isCrit ? Math.max(0, atkStageRaw) : atkStageRaw;
  let atkStat = Math.max(1, Math.floor(atkStatBase * stageMultiplier(atkStageEff)));
  // Burn halves physical Attack
  if (isBurned && move.category === 'physical') atkStat = Math.max(1, Math.floor(atkStat * 0.5));

  // Defender stat — crits ignore positive stages; weather buffs applied after
  const defStatBase   = calcStat(defBase, defender.evs[defKey], defender.ivs[defKey], defender.nature, defKey);
  const defStageRaw   = defKey === 'def' ? (defenderStages.def ?? 0) : (defenderStages.spd ?? 0);
  const defStageEff   = isCrit ? Math.min(0, defStageRaw) : defStageRaw;
  const defStatStaged = Math.max(1, Math.floor(defStatBase * stageMultiplier(defStageEff)));
  const defStat       = Math.max(1, Math.floor(defStatStaged * weatherDefMod(weather, defender.types, defKey)));
  const defHP         = calcStat(defender.baseHp, defender.evs.hp, defender.ivs.hp, defender.nature, 'hp');

  // Base damage before random roll
  const levelFactor = Math.floor((2 * 50) / 5 + 2); // = 22
  const rawDmg = Math.floor(Math.floor((levelFactor * move.basePower * atkStat) / defStat) / 50) + 2;

  const effectiveness = getEffectiveness(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  const terrainMod = terrainMoveMod(terrain, move.type, move.name, attacker.types, defender.types);

  // Screen modifier — crits bypass screens; doubles screens give 2/3 instead of 1/2
  const screenActive =
    (move.category === 'physical' && (reflect || auroraVeil)) ||
    (move.category === 'special'  && (lightScreen || auroraVeil));
  const screenMod = (!isCrit && screenActive) ? (isDoubles ? 2 / 3 : 0.5) : 1;

  const critMod        = isCrit ? 1.5 : 1;
  const spreadMod      = isSpread ? 0.75 : 1;
  const helpingHandMod = isHelpingHand ? 1.5 : 1;
  const itMod          = itemMod(attackerItem, move.category, effectiveness);

  // Generate all 16 rolls (85/100 … 100/100 random factor applied first, then chain modifiers)
  const rolls = Array.from({ length: 16 }, (_, i) => {
    let d = Math.floor(rawDmg * (85 + i) / 100);
    d = Math.floor(d * stab);
    d = Math.floor(d * effectiveness);
    d = Math.floor(d * moveMod);
    d = Math.floor(d * terrainMod);
    d = Math.floor(d * critMod);
    d = Math.floor(d * spreadMod);
    d = Math.floor(d * helpingHandMod);
    d = Math.floor(d * screenMod);
    d = Math.floor(d * itMod);
    return d;
  });

  const min = rolls[0];
  const max = rolls[15];
  const koPct = defHP > 0 ? Math.round((rolls.filter(r => r >= defHP).length / 16) * 100) : 0;

  return {
    min, max,
    minPct: defHP > 0 ? Math.round((min / defHP) * 100) : 0,
    maxPct: defHP > 0 ? Math.round((max / defHP) * 100) : 0,
    rolls, koPct,
    effectiveness,
    stab: stab > 1,
    category: move.category,
  };
}

/** Build a PokeSnapshot from PokeAPI stat names and spread. */
export function makeSnapshot(
  name: string,
  types: string[],
  stats: { name: string; base: number }[],
  nature: Nature,
  evs: EVSpread,
  ivs: EVSpread,
): PokeSnapshot {
  const get = (apiName: string) => stats.find(s => s.name === apiName)?.base ?? 0;
  return {
    name, types, nature, evs, ivs,
    baseHp:  get('hp'),
    baseAtk: get('attack'),
    baseDef: get('defense'),
    baseSpa: get('special-attack'),
    baseSpd: get('special-defense'),
    baseSpe: get('speed'),
  };
}

/** Helper: calculated HP for a snapshot. */
export function getHP(snap: PokeSnapshot): number {
  return calcStat(snap.baseHp, snap.evs.hp, snap.ivs.hp, snap.nature, 'hp');
}
