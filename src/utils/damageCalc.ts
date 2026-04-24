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

/** Gen 8/9 damage formula at Lv 50. Returns min/max damage and HP%. */
export function calcDamage(
  attacker: PokeSnapshot,
  move: MoveData,
  defender: PokeSnapshot,
): DamageResult {
  if (move.category === 'status' || move.basePower <= 0) {
    return { min: 0, max: 0, minPct: 0, maxPct: 0, effectiveness: 1, stab: false, category: move.category };
  }

  const atkKey = move.category === 'physical' ? 'atk' : 'spa';
  const defKey = move.category === 'physical' ? 'def' : 'spd';

  const atkBase = move.category === 'physical' ? attacker.baseAtk : attacker.baseSpa;
  const defBase = move.category === 'physical' ? defender.baseDef : defender.baseSpd;

  const atkStat = calcStat(atkBase, attacker.evs[atkKey], attacker.ivs[atkKey], attacker.nature, atkKey);
  const defStat = calcStat(defBase, defender.evs[defKey], defender.ivs[defKey], defender.nature, defKey);
  const defHP   = calcStat(defender.baseHp, defender.evs.hp, defender.ivs.hp, defender.nature, 'hp');

  // floor((floor((floor(2*50/5+2) * BP * Atk / Def) / 50) + 2) * modifiers)
  const levelFactor = Math.floor((2 * 50) / 5 + 2); // = 22
  const rawDmg = Math.floor(Math.floor((levelFactor * move.basePower * atkStat) / defStat) / 50) + 2;

  const effectiveness = getEffectiveness(move.type, defender.types);
  const stab = attacker.types.includes(move.type) ? 1.5 : 1;

  const max = Math.floor(rawDmg * stab * effectiveness);
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
