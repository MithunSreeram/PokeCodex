import type { Team, VGCRole } from '../../store/teamStore';
import { getTeamWeaknessMatrix } from '../../utils/typeChart';
import { TYPE_COLORS, TYPE_CODES } from '../../utils/typeColors';
import { teamToShowdown } from '../../utils/showdownExport';
import { calcStat, STAT_API_TO_KEY } from '../../utils/statCalc';
import { isChampionsEligible } from '../../utils/championsRoster';

const VGC_CORE_ROLES: VGCRole[] = [
  'Fake Out', 'Tailwind Setter', 'Trick Room Setter', 'Redirector', 'Speed Control',
];
const CHAMPIONS_CORE_ROLES: VGCRole[] = [
  'Fake Out', 'Tailwind Setter', 'Trick Room Setter', 'Redirector', 'Pivot', 'Speed Control',
];

interface Props { team: Team; }

export function TeamAnalysisPanel({ team }: Props) {
  const isChampions = team.format === 'Pokémon Champions';
  const memberTypes = team.members.map(m => m.pokemon.types);
  const weakMatrix = getTeamWeaknessMatrix(memberTypes);
  const presentRoles = new Set(team.members.map(m => m.role));
  const coreRoles = isChampions ? CHAMPIONS_CORE_ROLES : VGC_CORE_ROLES;
  const missingRoles = coreRoles.filter(r => !presentRoles.has(r));
  const restrictedCount = team.members.filter(m => m.isRestricted).length;
  const restrictedOk = restrictedCount <= 2;
  const ineligible = isChampions ? team.members.filter(m => !isChampionsEligible(m.pokemon.name)) : [];
  const offensiveTypes = [...new Set(team.members.flatMap(m => m.pokemon.types))];

  const speedTiers = [...team.members]
    .map(m => {
      const baseSpe = m.pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;
      const spe = calcStat(baseSpe, m.evs.spe, m.ivs.spe, m.nature, STAT_API_TO_KEY['speed']);
      return { name: m.nickname || m.pokemon.name, spe };
    })
    .sort((a, b) => b.spe - a.spe);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Format */}
      <div className="panel">
        <div className="panel-head">
          <span className="dot" />
          <h3>Format</h3>
        </div>
        <div style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span className="hud-title" style={{ fontSize: 12 }}>{team.format}</span>
            {isChampions && <span className="tag tag-cyan">CHAMP</span>}
          </div>
          {isChampions ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>✓ No restricted Pokémon</span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--green)' }}>✓ Standard 6-member roster</span>
            </div>
          ) : (
            <span className="mono" style={{ fontSize: 10, color: restrictedOk ? 'var(--green)' : 'var(--accent)' }}>
              {restrictedCount}/2 restricted{!restrictedOk ? ' — EXCEEDS LIMIT' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Ineligible warning */}
      {isChampions && ineligible.length > 0 && (
        <div className="panel" style={{ borderColor: 'var(--accent)' }}>
          <div className="panel-head" style={{ borderColor: 'var(--accent)' }}>
            <span className="dot" />
            <h3 style={{ color: 'var(--accent)' }}>Not in Roster</h3>
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {ineligible.map(m => (
              <span key={m.id} className="tag" style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'var(--accent-soft)', textTransform: 'capitalize' }}>
                {m.pokemon.name.replace(/-/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing roles */}
      {missingRoles.length > 0 && (
        <div className="panel" style={{ borderColor: 'rgba(255,179,0,.4)' }}>
          <div className="panel-head">
            <span className="dot" style={{ background: 'var(--amber)' }} />
            <h3>Missing Roles</h3>
          </div>
          <div style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {missingRoles.map(r => <span key={r} className="tag tag-amber">{r}</span>)}
          </div>
        </div>
      )}

      {/* Speed tiers */}
      {speedTiers.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="dot" />
            <h3>Speed Tiers · Lv.50</h3>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {speedTiers.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-1)', width: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'capitalize' }}>
                  {s.name.replace(/-/g, ' ')}
                </span>
                <div className="stat-bar" style={{ flex: 1 }}>
                  <i style={{ width: `${Math.min((s.spe / 350) * 100, 100)}%`, background: '#FA92B2' }} />
                </div>
                <span className="mono" style={{ fontSize: 10, color: '#FA92B2', width: 26, textAlign: 'right' }}>{s.spe}</span>
              </div>
            ))}
            <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>Tailwind ×2 · TR reverses</span>
          </div>
        </div>
      )}

      {/* Team weaknesses */}
      {Object.keys(weakMatrix).length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="dot" />
            <h3>Team Weaknesses</h3>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {Object.entries(weakMatrix)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const color = TYPE_COLORS[type]?.bg ?? '#545b73';
                const code = TYPE_CODES[type] ?? type.slice(0, 2).toUpperCase();
                return (
                  <div key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: color + '22', border: `1px solid ${color}55` }}>
                    <span className="mono" style={{ fontSize: 9, color }}>{code}</span>
                    <span className="mono" style={{ fontSize: 9, color, opacity: 0.7 }}>×{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Offensive coverage */}
      {offensiveTypes.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="dot" />
            <h3>Type Coverage</h3>
          </div>
          <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {offensiveTypes.map(type => {
              const color = TYPE_COLORS[type.toLowerCase()]?.bg ?? '#545b73';
              const code = TYPE_CODES[type.toLowerCase()] ?? type.slice(0, 2).toUpperCase();
              return (
                <span key={type} className="mono" style={{ fontSize: 9, color, padding: '2px 6px', background: color + '22', border: `1px solid ${color}44` }}>
                  {code}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Showdown export */}
      {team.members.length > 0 && (
        <button
          className="btn"
          onClick={() => navigator.clipboard.writeText(teamToShowdown(team.members))}
          style={{ width: '100%', padding: '8px', fontSize: 11 }}
        >
          ⎘ COPY SHOWDOWN EXPORT
        </button>
      )}
    </div>
  );
}
