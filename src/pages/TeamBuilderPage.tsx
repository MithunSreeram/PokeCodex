import { useState, useRef, useEffect, useCallback } from 'react';
import { useTeamStore } from '../store/teamStore';
import { MemberCard } from '../components/teambuilder/MemberCard';
import { TeamAnalysisPanel } from '../components/teambuilder/TeamAnalysisPanel';
import { searchPokemon, fetchAllPokemonNames } from '../api/pokeapi';
import { Spinner } from '../components/ui/Spinner';
import { isChampionsEligible } from '../utils/championsRoster';
import { suggestPrimaryRole } from '../utils/roleInference';

// ── Pokémon autocomplete search ───────────────────────────────────────────
interface SearchBoxProps {
  onAdd: (name: string) => Promise<void>;
  format: string;
  disabled?: boolean;
}

function PokemonSearchBox({ onAdd, format, disabled }: SearchBoxProps) {
  const [query, setQuery]               = useState('');
  const [suggestions, setSuggestions]   = useState<string[]>([]);
  const [allNames, setAllNames]         = useState<string[]>([]);
  const [open, setOpen]                 = useState(false);
  const [namesLoading, setNamesLoading] = useState(false);
  const [adding, setAdding]             = useState(false);
  const [error, setError]               = useState('');
  const containerRef                    = useRef<HTMLDivElement>(null);
  const isChampions = format === 'Pokémon Champions';

  const loadNames = useCallback(async () => {
    if (allNames.length > 0 || namesLoading) return;
    setNamesLoading(true);
    const names = await fetchAllPokemonNames();
    setAllNames(names);
    setNamesLoading(false);
  }, [allNames.length, namesLoading]);

  useEffect(() => {
    if (query.length < 2) { setSuggestions([]); return; }
    const q = query.toLowerCase().replace(/\s+/g, '-');
    const matches = allNames
      .filter(n => n.startsWith(q) || n.includes(q))
      .filter(n => !isChampions || isChampionsEligible(n))
      .slice(0, 8);
    setSuggestions(matches);
  }, [query, allNames, isChampions]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function submit(rawName: string) {
    const slug = rawName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!slug) return;
    setAdding(true);
    setError('');
    setOpen(false);
    const poke = await searchPokemon(slug);
    setAdding(false);
    if (!poke) { setError(`"${rawName}" not found`); return; }
    if (isChampions && !isChampionsEligible(poke.name)) {
      setError(`${poke.name.replace(/-/g, ' ')} is not in the Champions roster`);
      return;
    }
    await onAdd(poke.name);
    setQuery('');
    setSuggestions([]);
  }

  function handleSelect(name: string) {
    setQuery(name.replace(/-/g, ' '));
    setSuggestions([]);
    setOpen(false);
    submit(name);
  }

  const showDropdown = open && query.length >= 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <form onSubmit={e => { e.preventDefault(); submit(query); }} style={{ display: 'flex', gap: 8 }}>
        <div ref={containerRef} style={{ position: 'relative', flex: 1 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); setOpen(true); }}
            onFocus={() => { loadNames(); if (query.length >= 2) setOpen(true); }}
            placeholder={isChampions ? 'Search Champions roster…' : 'Add Pokémon by name (e.g. flutter-mane)'}
            disabled={disabled || adding}
            className="ipt"
            style={{ opacity: disabled || adding ? 0.5 : 1 }}
          />
          {showDropdown && (
            <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 2, background: 'var(--bg-2)', border: '1px solid var(--line-hard)', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
              {namesLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', color: 'var(--text-3)', fontSize: 11 }}>
                  <Spinner size={3} /> Loading list…
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => handleSelect(name)}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--text-1)', fontSize: 12, fontFamily: 'Chakra Petch', cursor: 'pointer', textTransform: 'capitalize' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {name.replace(/-/g, ' ')}
                  </button>
                ))
              ) : (
                <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text-3)' }}>
                  No {isChampions ? 'Champions-eligible ' : ''}Pokémon matching &quot;{query}&quot;
                </div>
              )}
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={adding || disabled}
          className="btn btn-primary"
          style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, opacity: adding || disabled ? 0.5 : 1 }}
        >
          {adding ? <Spinner size={3} /> : '+ ADD'}
        </button>
      </form>
      {error && <p style={{ margin: 0, fontSize: 11, color: 'var(--accent)' }}>{error}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export function TeamBuilderPage() {
  const { teams, activeTeamId, createTeam, deleteTeam, setActiveTeam, addMember } = useTeamStore();
  const activeTeam = teams.find(t => t.id === activeTeamId) ?? null;

  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamFormat, setNewTeamFormat] = useState<'VGC 2025 Series 2' | 'Pokémon Champions'>('VGC 2025 Series 2');

  async function handleAddPokemon(name: string) {
    if (!activeTeamId) return;
    const poke = await searchPokemon(name);
    if (!poke) return;
    const role = suggestPrimaryRole(poke);
    addMember(activeTeamId, poke, role);
  }

  function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const name = newTeamName.trim() || 'My Team';
    createTeam(name, newTeamFormat);
    setNewTeamName('');
  }

  function handleDeleteTeam(id: string, teamName: string) {
    if (!window.confirm(`Delete "${teamName}"? This cannot be undone.`)) return;
    deleteTeam(id);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="wrap-wide" style={{ paddingTop: 20, paddingBottom: 48 }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div className="hud-label" style={{ marginBottom: 4 }}>// THE CODEX — MODULE 02</div>
          <h1 className="hud-title" style={{ margin: 0, fontSize: 28 }}>
            <span style={{ color: 'var(--accent)' }}>TEAM</span> BUILDER
          </h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 14, alignItems: 'start' }}>

          {/* ── Sidebar: team management ─────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* New team form */}
            <div className="panel">
              <div className="panel-head">
                <span className="dot" />
                <h3>New Team</h3>
              </div>
              <div style={{ padding: 12 }}>
                <form onSubmit={handleCreateTeam} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    value={newTeamName}
                    onChange={e => setNewTeamName(e.target.value)}
                    placeholder="Team name"
                    className="ipt"
                    style={{ fontSize: 11 }}
                  />
                  <div className="seg">
                    <button
                      type="button"
                      className={newTeamFormat === 'VGC 2025 Series 2' ? 'active' : ''}
                      onClick={() => setNewTeamFormat('VGC 2025 Series 2')}
                    >VGC 2025</button>
                    <button
                      type="button"
                      className={newTeamFormat === 'Pokémon Champions' ? 'active' : ''}
                      onClick={() => setNewTeamFormat('Pokémon Champions')}
                      style={newTeamFormat === 'Pokémon Champions' ? { background: 'var(--champ)', color: '#fff' } : {}}
                    >CHAMP</button>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                    CREATE TEAM
                  </button>
                </form>
              </div>
            </div>

            {/* Team list */}
            {teams.length > 0 && (
              <div className="panel">
                <div className="panel-head">
                  <span className="dot" />
                  <h3>My Teams</h3>
                </div>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {teams.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setActiveTeam(t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 8px',
                        cursor: 'pointer',
                        background: t.id === activeTeamId ? 'var(--accent-soft)' : 'transparent',
                        border: t.id === activeTeamId ? '1px solid var(--accent)' : '1px solid transparent',
                        transition: 'all .1s',
                      }}
                      onMouseEnter={e => { if (t.id !== activeTeamId) (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
                      onMouseLeave={e => { if (t.id !== activeTeamId) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p className="hud-title" style={{ margin: 0, fontSize: 11, color: 'var(--text-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </p>
                        <p className="mono" style={{ margin: 0, fontSize: 9, color: 'var(--text-3)' }}>
                          {t.format === 'Pokémon Champions' ? 'CHAMPIONS' : 'VGC 2025'}
                        </p>
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', flexShrink: 0 }}>{t.members.length}/6</span>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteTeam(t.id, t.name); }}
                        style={{ background: 'transparent', border: 0, color: 'var(--text-3)', cursor: 'pointer', padding: '0 2px', fontSize: 14, lineHeight: 1 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
                      >×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Main: roster ─────────────────────────────────────────── */}
          <div>
            {!activeTeam ? (
              <div className="panel" style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div className="hud-label" style={{ marginBottom: 8 }}>NO TEAM SELECTED</div>
                <p style={{ color: 'var(--text-3)', fontSize: 12, margin: 0 }}>Create a team from the left panel to get started.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <div>
                    <h2 className="hud-title" style={{ margin: 0, fontSize: 18 }}>{activeTeam.name}</h2>
                    <p className="hud-label" style={{ margin: '3px 0 0' }}>
                      {activeTeam.format} · {activeTeam.members.length}/6
                    </p>
                  </div>
                  {activeTeam.members.length < 6 && (
                    <span className="tag tag-green">OPEN SLOTS</span>
                  )}
                </div>

                {activeTeam.members.length < 6 && (
                  <PokemonSearchBox onAdd={handleAddPokemon} format={activeTeam.format} />
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                  {activeTeam.members.map(m => (
                    <MemberCard key={m.id} member={m} teamId={activeTeam.id} format={activeTeam.format} />
                  ))}
                  {Array.from({ length: 6 - activeTeam.members.length }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="panel"
                      style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderColor: 'var(--line)' }}
                    >
                      <span className="hud-label" style={{ fontSize: 9, color: 'var(--text-3)' }}>EMPTY SLOT</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Analysis panel ───────────────────────────────────────── */}
          {activeTeam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="hud-label">// ANALYSIS</div>
              <TeamAnalysisPanel team={activeTeam} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
