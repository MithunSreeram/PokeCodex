import type { TeamMember } from '../store/teamStore';

// Showdown uses abbreviated stat names keyed by EVSpread keys (hp/atk/def/spa/spd/spe)
const EV_LABELS: Record<string, string> = {
  hp: 'HP', atk: 'Atk', def: 'Def', spa: 'SpA', spd: 'SpD', spe: 'Spe',
};

function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function formatMove(name: string) { return name.split('-').map(capitalize).join(' '); }

export function memberToShowdown(m: TeamMember): string {
  const lines: string[] = [];
  const display = m.nickname
    ? `${m.nickname} (${capitalize(m.pokemon.name)})`
    : capitalize(m.pokemon.name);

  lines.push(m.item ? `${display} @ ${m.item}` : display);
  lines.push(`Ability: ${capitalize(m.ability)}`);
  if (m.teraType) lines.push(`Tera Type: ${capitalize(m.teraType)}`);

  const evParts = Object.entries(m.evs)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${v} ${EV_LABELS[k] ?? k.toUpperCase()}`);
  if (evParts.length) lines.push(`EVs: ${evParts.join(' / ')}`);

  lines.push(`${m.nature} Nature`);

  const ivParts = Object.entries(m.ivs)
    .filter(([, v]) => v !== 31)
    .map(([k, v]) => `${v} ${EV_LABELS[k] ?? k.toUpperCase()}`);
  if (ivParts.length) lines.push(`IVs: ${ivParts.join(' / ')}`);

  for (const move of m.moves) {
    if (move) lines.push(`- ${formatMove(move)}`);
  }
  return lines.join('\n');
}

export function teamToShowdown(members: TeamMember[]): string {
  return members.map(memberToShowdown).join('\n\n');
}
