import { useState } from 'react';
import { useTeamStore } from '../store/teamStore';
import { MemberCard } from '../components/teambuilder/MemberCard';
import { TeamAnalysisPanel } from '../components/teambuilder/TeamAnalysisPanel';
import { searchPokemon } from '../api/pokeapi';
import { Spinner } from '../components/ui/Spinner';

export function TeamBuilderPage() {
  const { teams, activeTeamId, createTeam, deleteTeam, setActiveTeam, addMember } = useTeamStore();
  const activeTeam = teams.find(t => t.id === activeTeamId) ?? null;

  const [newTeamName, setNewTeamName] = useState('');
  const [addQuery, setAddQuery] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  async function handleAddPokemon(e: React.FormEvent) {
    e.preventDefault();
    if (!addQuery.trim() || !activeTeamId) return;
    setAddLoading(true);
    setAddError('');
    const poke = await searchPokemon(addQuery.trim());
    setAddLoading(false);
    if (!poke) {
      setAddError(`Could not find "${addQuery}"`);
      return;
    }
    addMember(activeTeamId, poke);
    setAddQuery('');
  }

  function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    const name = newTeamName.trim() || 'My Team';
    createTeam(name);
    setNewTeamName('');
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-6 flex-col lg:flex-row">
        {/* Sidebar */}
        <aside className="lg:w-64 space-y-4 shrink-0">
          {/* Create Team */}
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <h2 className="text-sm font-bold text-gray-300 mb-3">New Team</h2>
            <form onSubmit={handleCreateTeam} className="flex gap-2">
              <input
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="Team name"
                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-bold transition-colors"
              >
                +
              </button>
            </form>
          </div>

          {/* Team List */}
          {teams.length > 0 && (
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <h2 className="text-sm font-bold text-gray-300 mb-3">My Teams</h2>
              <div className="space-y-1.5">
                {teams.map(t => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-colors ${
                      t.id === activeTeamId
                        ? 'bg-red-600/20 border border-red-600/50 text-white'
                        : 'hover:bg-gray-700 text-gray-400'
                    }`}
                    onClick={() => setActiveTeam(t.id)}
                  >
                    <span className="flex-1 text-sm font-medium truncate">{t.name}</span>
                    <span className="text-xs text-gray-500">{t.members.length}/6</span>
                    <button
                      onClick={e => { e.stopPropagation(); deleteTeam(t.id); }}
                      className="text-gray-600 hover:text-red-400 text-sm"
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
        <main className="flex-1 space-y-5">
          {!activeTeam ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-3">
              <p className="text-lg">No team selected.</p>
              <p className="text-sm">Create a team from the sidebar to get started.</p>
            </div>
          ) : (
            <>
              {/* Team Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{activeTeam.name}</h1>
                  <p className="text-sm text-gray-400">{activeTeam.format} · {activeTeam.members.length}/6</p>
                </div>
              </div>

              {/* Add Pokémon */}
              {activeTeam.members.length < 6 && (
                <form onSubmit={handleAddPokemon} className="flex gap-2">
                  <input
                    value={addQuery}
                    onChange={e => { setAddQuery(e.target.value); setAddError(''); }}
                    placeholder="Add Pokémon by name (e.g. flutter-mane)"
                    className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="submit"
                    disabled={addLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
                  >
                    {addLoading ? <Spinner size={4} /> : 'Add'}
                  </button>
                </form>
              )}
              {addError && <p className="text-red-400 text-sm">{addError}</p>}

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeTeam.members.map(m => (
                  <MemberCard key={m.id} member={m} teamId={activeTeam.id} />
                ))}
                {/* Empty slots */}
                {Array.from({ length: 6 - activeTeam.members.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    className="rounded-2xl border-2 border-dashed border-gray-700 h-40 flex items-center justify-center text-gray-600 text-sm"
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
