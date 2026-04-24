import type { TeamMember } from '../store/teamStore';
import type { InferredOpponent } from './opponentInference';
import { calcStat } from './statCalc';
import { getEffectiveness } from './typeChart';
import { getDefensiveProfile } from './typeChart';

export interface ScoredMember {
  member: TeamMember;
  score: number;
  reasons: string[];
}

function getSpe(member: TeamMember): number {
  const base = member.pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;
  return calcStat(base, member.evs.spe, member.ivs.spe, member.nature, 'spe');
}

function getBestStabEffectiveness(member: TeamMember, opp: InferredOpponent): number {
  return member.pokemon.types.reduce((best, type) => {
    const eff = getEffectiveness(type, opp.pokemon.types);
    return Math.max(best, eff);
  }, 0);
}

/** Score each member of our team against the opponent's full team. */
export function scoreMembers(team: TeamMember[], opponents: InferredOpponent[]): ScoredMember[] {
  return team.map(member => {
    let score = 0;
    const reasons: string[] = [];
    const defProfile = getDefensiveProfile(member.pokemon.types);
    const mySpe = getSpe(member);

    for (const opp of opponents) {
      const oppName = opp.pokemon.name.replace(/-/g, ' ');

      // Offensive STAB coverage
      const eff = getBestStabEffectiveness(member, opp);
      if (eff >= 4) { score += 3; reasons.push(`4× hits ${oppName}`); }
      else if (eff >= 2) { score += 1.5; reasons.push(`2× hits ${oppName}`); }
      else if (eff === 0) score -= 1.5;
      else if (eff < 1)  score -= 0.5;
      else score += 0.5; // neutral

      // Speed tier advantage
      const theirBase = opp.pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;
      const theirSpe  = calcStat(theirBase, opp.evs.spe, opp.ivs.spe, opp.nature, 'spe');
      if (mySpe > theirSpe) score += 0.4;

      // Resistances to opponent's inferred move types
      for (const mv of opp.moves) {
        if (mv.category === 'status') continue;
        const incoming = defProfile[mv.type] ?? 1;
        if (incoming < 1) score += 0.3;
        else if (incoming > 1) score -= 0.2;
      }
    }

    // Deduplicate reasons, keep top 2
    const seen = new Set<string>();
    const uniqueReasons = reasons.filter(r => { if (seen.has(r)) return false; seen.add(r); return true; }).slice(0, 2);

    return { member, score, reasons: uniqueReasons };
  });
}

/**
 * Recommend which `count` Pokémon to bring from the team.
 * Tries to preserve role diversity (at least 1 support/setter if available).
 */
export function suggestPick(
  team: TeamMember[],
  opponents: InferredOpponent[],
  count: 3 | 4 = 4,
): ScoredMember[] {
  const scored = scoreMembers(team, opponents).sort((a, b) => b.score - a.score);

  // Greedy pick top `count`, but swap in a setter/support if none selected
  const pick = scored.slice(0, count);
  const hasSetter = pick.some(p =>
    ['Tailwind Setter', 'Trick Room Setter', 'Redirector', 'Support', 'Fake Out'].includes(p.member.role)
  );

  if (!hasSetter) {
    const setter = scored.slice(count).find(p =>
      ['Tailwind Setter', 'Trick Room Setter', 'Redirector', 'Support', 'Fake Out'].includes(p.member.role)
    );
    if (setter) {
      // Replace lowest-scoring pick with the setter
      pick[count - 1] = setter;
    }
  }

  return pick;
}
