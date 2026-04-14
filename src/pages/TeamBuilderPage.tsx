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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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
    <div className="space-y-1">
      <form onSubmit={e => { e.preventDefault(); submit(query); }} className="flex gap-2">
        <div ref={containerRef} className="relative flex-1">
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setError(''); setOpen(true); }}
            onFocus={() => { loadNames(); if (query.length >= 2) setOpen(true); }}
            placeholder={isChampions ? 'Search Champions roster…' : 'Add Pokémon by name (e.g. flutter-mane)'}
            disabled={disabled || adding}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors disabled:opacity-50"
          />

          {showDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600/80 rounded-xl shadow-2xl overflow-hidden">
              {namesLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-gray-500 text-sm">
                  <Spinner size={3} /> Loading Pokémon list…
                </div>
              ) : suggestions.length > 0 ? (
                suggestions.map(name => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => handleSelect(name)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700 hover:text-white transition-colors capitalize"
                  >
                    {name.replace(/-/g, ' ')}
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-xs text-gray-500">
                  No {isChampions ? 'Champions-eligible' : ''} Pokémon matching "{query}"
                </div>
              )}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={adding || disabled}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shrink-0"
        >
          {adding ? <Spinner size={4} /> : 'Add'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm pl-1">{error}</p>}
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
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6 flex-col lg:flex-row">

        {/* Sidebar */}
        <aside className="lg:w-64 space-y-4 shrink-0">
          <div className="bg-gray-800/80 rounded-2xl p-4 border border-gray-700 shadow-lg">
            <h2 className="text-sm font-bold text-gray-300 mb-3">New Team</h2>
            <form onSubmit={handleCreateTeam} className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={newTeamName}
                  onChange={e => setNewTeamName(e.target.value)}
                  placeholder="Team name"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500 transition-colors"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-colors"
                >
                  +
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewTeamFormat('VGC 2025 Series 2')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    newTeamFormat === 'VGC 2025 Series 2'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  VGC 2025
                </button>
                <button
                  type="button"
                  onClick={() => setNewTeamFormat('Pokémon Champions')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    newTeamFormat === 'Pokémon Champions'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  Champions
                </button>
              </div>
            </form>
          </div>

          {teams.length > 0 && (
            <div className="bg-gray-800/80 rounded-2xl p-4 border border-gray-700 shadow-lg">
              <h2 className="text-sm font-bold text-gray-300 mb-3">My Teams</h2>
              <div className="space-y-1.5">
                {teams.map(t => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all duration-150 ${
                      t.id === activeTeamId
                        ? 'bg-red-600/20 border border-red-600/50 text-white'
                        : 'hover:bg-gray-700/60 text-gray-400 border border-transparent'
                    }`}
                    onClick={() => setActiveTeam(t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.name}</p>
                      <p className="text-xs text-gray-600 truncate">
                        {t.format === 'Pokémon Champions' ? 'Champions' : 'VGC 2025'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">{t.members.length}/6</span>
                    <button
                      onClick={e => { e.stopPropagation(); handleDeleteTeam(t.id, t.name); }}
                      className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                      title="Delete team"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 space-y-5 min-w-0">
          {!activeTeam ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
              <p className="text-lg">No team selected.</p>
              <p className="text-sm">Create a team from the sidebar to get started.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{activeTeam.name}</h1>
                  <p className="text-sm text-gray-400">
                    {activeTeam.format} · {activeTeam.members.length}/6
                  </p>
                </div>
              </div>

              {activeTeam.members.length < 6 && (
                <PokemonSearchBox onAdd={handleAddPokemon} format={activeTeam.format} />
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeTeam.members.map(m => (
                  <MemberCard key={m.id} member={m} teamId={activeTeam.id} format={activeTeam.format} />
                ))}
                {Array.from({ length: 6 - activeTeam.members.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="rounded-2xl border-2 border-dashed border-gray-800 h-40 flex items-center justify-center text-gray-700 text-sm hover:border-gray-700 transition-colors"
                  >
                    Empty slot
                  </div>
                ))}
              </div>
            </>
          )}
        </main>

        {/* Analysis */}
        {activeTeam && (
          <aside className="lg:w-72 shrink-0">
            <h2 className="text-sm font-bold text-gray-300 mb-3">Team Analysis</h2>
            <TeamAnalysisPanel team={activeTeam} />
          </aside>
        )}
      </div>
    </div>
  );
}
