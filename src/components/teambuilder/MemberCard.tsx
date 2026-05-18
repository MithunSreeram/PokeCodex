import { useState, useEffect } from 'react';
import type { TeamMember, VGCRole } from '../../store/teamStore';
import { TypeBadge } from '../ui/TypeBadge';
import { useTeamStore } from '../../store/teamStore';
import { calcStat, getNatureEffect, STAT_ORDER, clampEV } from '../../utils/statCalc';
import { memberToShowdown } from '../../utils/showdownExport';
import { MoveInput } from './MoveInput';
import { isChampionsEligible } from '../../utils/championsRoster';
import { getEligibleRoles, ALL_ROLES } from '../../utils/roleInference';
import { fetchAbilityEffect } from '../../api/pokeapi';

const NATURES = [
  'Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed',
  'Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild',
  'Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky',
];

interface Props {
  member: TeamMember;
  teamId: string;
  format?: string;
}

export function MemberCard({ member, teamId, format }: Props) {
  const isChampions = format === 'Pokémon Champions';
  const eligible    = !isChampions || isChampionsEligible(member.pokemon.name);

  const { removeMember, updateMember } = useTeamStore();
  const artwork =
    member.pokemon.sprites.other?.['official-artwork']?.front_default ??
    member.pokemon.sprites.front_default;

  const [abilityDesc, setAbilityDesc] = useState('');

  useEffect(() => {
    let cancelled = false;
    setAbilityDesc('');
    if (!member.ability) return;
    fetchAbilityEffect(member.ability)
      .then(d => { if (!cancelled) setAbilityDesc(d); })
      .catch(() => { if (!cancelled) setAbilityDesc('No description available.'); });
    return () => { cancelled = true; };
  }, [member.ability]);

  function patch(p: Partial<TeamMember>) { updateMember(teamId, member.id, p); }

  const evTotal     = Object.values(member.evs).reduce((a, b) => a + b, 0);
  const evRemaining = 510 - evTotal;
  const { up: natureUp, down: natureDown } = getNatureEffect(member.nature);

  function setEV(key: keyof TeamMember['evs'], raw: string) {
    patch({ evs: clampEV(member.evs, key, parseInt(raw) || 0) });
  }
  function setIV(key: keyof TeamMember['ivs'], raw: string) {
    const val = Math.max(0, Math.min(31, parseInt(raw) || 0));
    patch({ ivs: { ...member.ivs, [key]: val } });
  }
  function setMove(index: number, slug: string) {
    const moves = [...member.moves] as [string, string, string, string];
    moves[index] = slug;
    patch({ moves });
  }

  const eligibleRoles = getEligibleRoles(member.pokemon);
  const otherRoles    = ALL_ROLES.filter(r => !eligibleRoles.includes(r));
  const roleIsValid   = eligibleRoles.includes(member.role);

  const ipt: React.CSSProperties = {
    appearance: 'none', border: '1px solid var(--line-hard)', background: 'var(--bg-0)',
    color: 'var(--text-0)', padding: '4px 8px', fontFamily: 'Chakra Petch', fontSize: 11,
    width: '100%', outline: 'none',
  };

  return (
    <div className="panel" style={{ border: eligible ? '1px solid var(--line)' : '1px solid var(--accent)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
        <img src={artwork ?? ''} alt={member.pokemon.name} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="hud-title" style={{ fontSize: 12, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.pokemon.name.replace(/-/g, ' ')}
            </span>
            {isChampions && !eligible && <span className="tag" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-soft)' }}>INELIGIBLE</span>}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          <button
            onClick={() => removeMember(teamId, member.id)}
            style={{ background: 'transparent', border: 0, color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
          >×</button>
          <button
            onClick={() => navigator.clipboard.writeText(memberToShowdown(member))}
            style={{ background: 'transparent', border: 0, color: 'var(--text-3)', cursor: 'pointer', fontSize: 11, lineHeight: 1, padding: 0 }}
            title="Copy Showdown export"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--cyan)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
          >⎘</button>
        </div>
      </div>

      <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {/* Nickname */}
        <input
          placeholder="Nickname"
          value={member.nickname}
          onChange={e => patch({ nickname: e.target.value })}
          style={ipt}
        />

        {/* Role */}
        <div>
          <select
            value={member.role}
            onChange={e => patch({ role: e.target.value as VGCRole })}
            style={ipt}
          >
            {eligibleRoles.length > 0 && (
              <optgroup label="✦ Fits this Pokémon">
                {eligibleRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            )}
            {otherRoles.length > 0 && (
              <optgroup label="Other roles">
                {otherRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            )}
          </select>
          {member.role && (
            <p style={{ margin: '2px 0 0', fontSize: 9, paddingLeft: 2, color: roleIsValid ? 'var(--green)' : eligibleRoles.length > 0 ? 'var(--amber)' : 'var(--text-3)' }}>
              {roleIsValid ? '✓ Role confirmed' : eligibleRoles.length > 0 ? `⚠ Suggested: ${eligibleRoles[0]}` : ''}
            </p>
          )}
        </div>

        {/* Nature + Ability */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <select value={member.nature} onChange={e => patch({ nature: e.target.value as TeamMember['nature'] })} style={ipt}>
            {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={member.ability} onChange={e => patch({ ability: e.target.value })} style={{ ...ipt, textTransform: 'capitalize' }}>
            {member.pokemon.abilities.map(a => (
              <option key={a.name} value={a.name}>{a.name.replace(/-/g, ' ')}{a.isHidden ? ' (HA)' : ''}</option>
            ))}
          </select>
        </div>

        {/* Ability description */}
        <p style={{ margin: 0, fontSize: 10, lineHeight: 1.5, color: abilityDesc ? 'var(--text-3)' : 'var(--line-hard)', minHeight: 14 }}>
          {abilityDesc || (member.ability ? 'Loading…' : '')}
        </p>

        {/* Item + Tera */}
        <input placeholder="Held item" value={member.item} onChange={e => patch({ item: e.target.value })} style={ipt} />
        <input placeholder="Tera Type" value={member.teraType} onChange={e => patch({ teraType: e.target.value })} style={{ ...ipt, textTransform: 'capitalize' }} />

        {/* Moves */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {member.moves.map((mv, i) => (
            <MoveInput key={i} value={mv} onChange={slug => setMove(i, slug)} legalMoves={member.pokemon.moves} placeholder={`Move ${i + 1}`} />
          ))}
        </div>

        {/* EV / IV Editor */}
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="hud-label" style={{ fontSize: 9 }}>EVs / IVs</span>
            <span className="mono" style={{ fontSize: 9, color: evRemaining < 0 ? 'var(--accent)' : evRemaining === 0 ? 'var(--green)' : 'var(--text-3)' }}>
              {evRemaining} left
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px 6px' }}>
            {STAT_ORDER.map(({ key, apiName, label }) => {
              const base = member.pokemon.stats.find(s => s.name === apiName)?.base ?? 0;
              const calc = calcStat(base, member.evs[key], member.ivs[key], member.nature, key);
              const isUp   = natureUp   === key;
              const isDown = natureDown === key;
              const ivNonStandard = member.ivs[key] < 31;
              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="hud-label" style={{ fontSize: 8, color: isUp ? 'var(--accent)' : isDown ? 'var(--cyan)' : 'var(--text-3)' }}>{label}</span>
                    <span className="mono" style={{ fontSize: 9, color: 'var(--text-1)' }}>{calc}</span>
                  </div>
                  <input type="number" min={0} max={252} step={4} value={member.evs[key]}
                    onChange={e => setEV(key, e.target.value)}
                    style={{ ...ipt, textAlign: 'center', height: 22, fontSize: 10, padding: '0 2px' }}
                  />
                  <input type="number" min={0} max={31} value={member.ivs[key]}
                    onChange={e => setIV(key, e.target.value)}
                    style={{ ...ipt, textAlign: 'center', height: 18, fontSize: 9, padding: '0 2px', color: ivNonStandard ? 'var(--amber)' : 'var(--text-3)', borderColor: ivNonStandard ? 'rgba(255,179,0,.5)' : 'var(--line)' }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span className="mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>top = EVs</span>
            <span className="mono" style={{ fontSize: 8, color: 'var(--text-3)' }}>bottom = IVs</span>
          </div>
        </div>

        {/* Restricted toggle */}
        {!isChampions && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', paddingTop: 4 }}>
            <input type="checkbox" checked={member.isRestricted} onChange={e => patch({ isRestricted: e.target.checked })} style={{ accentColor: 'var(--accent)' }} />
            <span className="hud-label" style={{ fontSize: 9 }}>Restricted Legendary</span>
          </label>
        )}
      </div>
    </div>
  );
}
