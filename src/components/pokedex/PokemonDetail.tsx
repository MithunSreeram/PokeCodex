import { useState, useEffect } from 'react';
import type { Pokemon } from '../../api/pokeapi';
import { fetchAbilityEffect } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { getDefensiveProfile } from '../../utils/typeChart';
import { TYPE_COLORS, STAT_LABELS } from '../../utils/typeColors';
import { useTeamStore } from '../../store/teamStore';
import { isChampionsEligible } from '../../utils/championsRoster';
import { suggestPrimaryRole } from '../../utils/roleInference';

interface Props {
  pokemon: Pokemon;
  onClose: () => void;
}

export function PokemonDetail({ pokemon, onClose }: Props) {
  const { teams, activeTeamId, addMember, createTeam } = useTeamStore();
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const profile = getDefensiveProfile(pokemon.types);
  const primaryColor = TYPE_COLORS[pokemon.types[0].toLowerCase()]?.bg ?? '#545b73';
  const totalBase = pokemon.stats.reduce((s, st) => s + st.base, 0);

  const [shiny, setShiny] = useState(false);
  const [added, setAdded] = useState(false);
  const [abilityEffects, setAbilityEffects] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setAbilityEffects({});
    pokemon.abilities.forEach(a => {
      fetchAbilityEffect(a.name)
        .then(effect => { if (!cancelled) setAbilityEffects(prev => ({ ...prev, [a.name]: effect })); })
        .catch(() =>    { if (!cancelled) setAbilityEffects(prev => ({ ...prev, [a.name]: 'No description available.' })); });
    });
    return () => { cancelled = true; };
  }, [pokemon.id]);

  const normalArt = pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default;
  const shinyArt  = pokemon.sprites.other?.['official-artwork']?.front_shiny   ?? pokemon.sprites.front_shiny;
  const artwork   = shiny && shinyArt ? shinyArt : normalArt;

  const championsIneligible = activeTeam?.format === 'Pokémon Champions' && !isChampionsEligible(pokemon.name);
  const teamFull = activeTeam ? activeTeam.members.length >= 6 : false;

  function handleAddToTeam() {
    if (championsIneligible || teamFull) return;
    const role = suggestPrimaryRole(pokemon);
    if (!activeTeamId) {
      const id = createTeam('My Team');
      useTeamStore.getState().addMember(id, pokemon, role);
    } else {
      addMember(activeTeamId, pokemon, role);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const weaknesses  = Object.entries(profile).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
  const resistances = Object.entries(profile).filter(([, v]) => v < 1 && v > 0).sort((a, b) => a[1] - b[1]);
  const immunities  = Object.entries(profile).filter(([, v]) => v === 0);

  const maxStat = 180;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(7,8,11,.75)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 520, height: '100%', background: 'var(--bg-1)', borderLeft: '1px solid var(--line)', boxShadow: '-20px 0 60px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ position: 'relative', padding: '20px 20px 16px', borderBottom: '1px solid var(--line)', background: `radial-gradient(60% 100% at 30% 0%, ${primaryColor}1c, transparent 70%), var(--bg-1)`, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div className="hud-label" style={{ marginBottom: 4 }}>
                // CODEX ENTRY #{String(pokemon.id).padStart(4, '0')}
              </div>
              <h2 className="hud-title" style={{ margin: 0, fontSize: 24, textTransform: 'capitalize' }}>
                {pokemon.name.replace(/-/g, ' ')}
              </h2>
              <div style={{ display: 'flex', gap: 5, marginTop: 7, alignItems: 'center' }}>
                {pokemon.types.map(t => <TypeBadge key={t} type={t} />)}
                <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>BST {totalBase}</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
              <button className="btn btn-sm" onClick={onClose}>CLOSE ×</button>
              {shinyArt && (
                <button
                  className={`btn btn-sm ${shiny ? 'btn-primary' : ''}`}
                  onClick={() => setShiny(s => !s)}
                >
                  ✦ SHINY
                </button>
              )}
            </div>
          </div>

          {/* Sprite */}
          <div style={{ position: 'absolute', right: 20, top: 12, width: 110, height: 110 }}>
            {artwork && (
              <img
                src={artwork}
                alt={pokemon.name}
                style={{ width: '100%', height: '100%', objectFit: 'contain', filter: shiny ? 'drop-shadow(0 0 12px rgba(250,204,21,.5))' : undefined }}
              />
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Quick info row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {[
              { label: 'HEIGHT', value: `${(pokemon.height / 10).toFixed(1)} m` },
              { label: 'WEIGHT', value: `${(pokemon.weight / 10).toFixed(1)} kg` },
              { label: 'BASE XP', value: String(pokemon.baseExperience ?? '—') },
            ].map(({ label, value }) => (
              <div key={label} className="panel" style={{ padding: '8px 10px' }}>
                <div className="hud-label" style={{ fontSize: 9, marginBottom: 3 }}>{label}</div>
                <div className="mono" style={{ fontSize: 13, color: 'var(--text-0)' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Base stats */}
          <div className="panel">
            <div className="panel-head">
              <span className="dot" />
              <h3>Base Stats</h3>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
              {pokemon.stats.map(s => {
                const label = STAT_LABELS[s.name] ?? s.name;
                const pct = Math.round((s.base / maxStat) * 100);
                const color = s.base >= 110 ? 'var(--green)' : s.base <= 60 ? 'var(--amber)' : 'var(--accent)';
                return (
                  <div key={s.name} style={{ display: 'grid', gridTemplateColumns: '36px 34px 1fr', gap: 8, alignItems: 'center' }}>
                    <span className="hud-label" style={{ fontSize: 9 }}>{label}</span>
                    <span className="mono" style={{ fontSize: 12, color }}>{s.base}</span>
                    <div className="stat-bar">
                      <i style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Abilities */}
          <div className="panel">
            <div className="panel-head">
              <span className="dot" />
              <h3>Abilities</h3>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pokemon.abilities.map(a => (
                <div key={a.name}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span className="hud-title" style={{ fontSize: 12, textTransform: 'capitalize' }}>
                      {a.name.replace(/-/g, ' ')}
                    </span>
                    {a.isHidden && <span className="tag tag-cyan">HA</span>}
                  </div>
                  <p style={{ margin: 0, fontSize: 11, color: abilityEffects[a.name] ? 'var(--text-2)' : 'var(--text-3)', lineHeight: 1.5 }}>
                    {abilityEffects[a.name] ?? 'Loading…'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Type matchups */}
          <div className="panel">
            <div className="panel-head">
              <span className="dot" />
              <h3>Type Matchup</h3>
            </div>
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {weaknesses.length > 0 && (
                <MatchupRow label="WEAK TO" types={weaknesses} color="var(--accent)" />
              )}
              {resistances.length > 0 && (
                <MatchupRow label="RESISTS" types={resistances} color="var(--cyan)" />
              )}
              {immunities.length > 0 && (
                <MatchupRow label="IMMUNE" types={immunities} color="var(--green)" />
              )}
            </div>
          </div>

          {/* Add to team */}
          <button
            className={`btn ${added ? '' : championsIneligible || teamFull ? '' : 'btn-primary'}`}
            onClick={handleAddToTeam}
            disabled={!added && (teamFull || championsIneligible)}
            style={{
              width: '100%',
              padding: '9px',
              fontSize: 12,
              background: added ? 'var(--green)' : championsIneligible ? 'var(--bg-2)' : undefined,
              color: added ? '#0a0b0e' : undefined,
              opacity: !added && (championsIneligible || teamFull) ? 0.5 : 1,
              cursor: !added && (championsIneligible || teamFull) ? 'not-allowed' : 'pointer',
            }}
          >
            {added
              ? '✓ ADDED TO TEAM'
              : championsIneligible
                ? 'NOT IN CHAMPIONS ROSTER'
                : teamFull
                  ? 'TEAM FULL (6/6)'
                  : activeTeam
                    ? `ADD TO "${activeTeam.name.toUpperCase()}"`
                    : 'ADD TO NEW TEAM'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchupRow({ label, types, color }: { label: string; types: [string, number][]; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span className="hud-label" style={{ color, width: 68, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {types.map(([type, mult]) => (
          <span key={type} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <TypeBadge type={type} size="sm" />
            <span className="mono" style={{ fontSize: 9, color }}>{mult < 1 ? `×${mult}` : `×${mult}`}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
