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
  min: number;       // damage value, floor at 0.85 roll
  max: number;       // damage value, at 1.0 roll
  minPct: number;    // % of defender's HP (rounded)
  maxPct: number;
  effectiveness: number;
  stab: boolean;
  category: 'physical' | 'special' | 'status';
}

/** Per-Pokémon in-battle stat stage modifiers (-6 to +6). */
export interface StatStages {
  atk: number;
  spa: number;
  def: number;
  spd: number;
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

/** Gen 8/9 damage formula at Lv 50. Returns min/max damage and HP%. */
export function calcDamage(
  attacker: PokeSnapshot,
  move: MoveData,
  defender: PokeSnapshot,
  weather: Weather = 'none',
  attackerStages: Partial<StatStages> = {},
  defenderStages: Partial<StatStages> = {},
): DamageResult {
  if (move.category === 'status' || move.basePower <= 0) {
    return { min: 0, max: 0, minPct: 0, maxPct: 0, effectiveness: 1, stab: false, category: move.category };
  }

  const moveMod = weatherMoveMod(weather, move.type);
  if (moveMod === 0) {
    // Move fails entirely (Desolate Land / Primordial Sea)
    const typeEff = getEffectiveness(move.type, defender.types);
    return { min: 0, max: 0, minPct: 0, maxPct: 0, effectiveness: typeEff, stab: false, category: move.category };
  }

  const atkKey = move.category === 'physical' ? 'atk' : 'spa';
  const defKey = move.category === 'physical' ? 'def' : 'spd';

  const atkBase = move.category === 'physical' ? attacker.baseAtk : attacker.baseSpa;
  const defBase = move.category === 'physical' ? defender.baseDef : defender.baseSpd;

  // Stat stages applied to the calculated stat, weather defense applied after
  const atkStatBase = calcStat(atkBase, attacker.evs[atkKey], attacker.ivs[atkKey], attacker.nature, atkKey);
  const atkStageVal = atkKey === 'atk' ? (attackerStages.atk ?? 0) : (attackerStages.spa ?? 0);
  const atkStat     = Math.max(1, Math.floor(atkStatBase * stageMultiplier(atkStageVal)));

  const defStatBase  = calcStat(defBase, defender.evs[defKey], defender.ivs[defKey], defender.nature, defKey);
  const defStageVal  = defKey === 'def' ? (defenderStages.def ?? 0) : (defenderStages.spd ?? 0);
  const defStatStaged = Math.max(1, Math.floor(defStatBase * stageMultiplier(defStageVal)));
  // Sand buffs Rock SpD; Snow buffs Ice Def — applied on top of stage-modified stat
  const defStat = Math.max(1, Math.floor(defStatStaged * weatherDefMod(weather, defender.types, defKey)));

  const defHP = calcStat(defender.baseHp, defender.evs.hp, defender.ivs.hp, defender.nature, 'hp');

  // floor((floor((floor(2*50/5+2) * BP * Atk / Def) / 50) + 2) * modifiers)
  const levelFactor = Math.floor((2 * 50) / 5 + 2); // = 22
  const rawDmg = Math.floor(Math.floor((levelFactor * move.basePower * atkStat) / defStat) / 50) + 2;

  const effectiveness = getEffectiveness(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  const max = Math.floor(rawDmg * stab * effectiveness * moveMod);
  const min = Math.floor(max * 0.85);

  return {
    min, max,
    minPct: defHP > 0 ? Math.round((min / defHP) * 100) : 0,
    maxPct: defHP > 0 ? Math.round((max / defHP) * 100) : 0,
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
