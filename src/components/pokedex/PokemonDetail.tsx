import type { Pokemon } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { StatBar } from '../ui/StatBar';
import { getDefensiveProfile } from '../../utils/typeChart';
import { TYPE_COLORS } from '../../utils/typeColors';
import { useTeamStore } from '../../store/teamStore';

interface Props {
  pokemon: Pokemon;
  onClose: () => void;
}

export function PokemonDetail({ pokemon, onClose }: Props) {
  const { teams, activeTeamId, addMember, createTeam } = useTeamStore();
  const activeTeam = teams.find(t => t.id === activeTeamId);
  const profile = getDefensiveProfile(pokemon.types);
  const primaryColor = TYPE_COLORS[pokemon.types[0]]?.bg ?? '#555';
  const artwork = pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default;
  const totalBase = pokemon.stats.reduce((s, st) => s + st.base, 0);

  function handleAddToTeam() {
    if (!activeTeamId) {
      const id = createTeam('My Team');
      useTeamStore.getState().addMember(id, pokemon);
    } else {
      addMember(activeTeamId, pokemon);
    }
  }

  const weaknesses = Object.entries(profile).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
  const resistances = Object.entries(profile).filter(([, v]) => v < 1).sort((a, b) => a[1] - b[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={e => e.stopPropagation()}>
        <div className="relative h-48 rounded-t-3xl flex items-end px-6 pb-4" style={{ background: `linear-gradient(135deg, ${primaryColor}55, ${primaryColor}22)` }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl leading-none">×</button>
          <img src={artwork ?? ''} alt={pokemon.name} className="absolute right-6 bottom-0 w-40 h-40 object-contain drop-shadow-2xl" />
          <div>
            <p className="text-gray-400 text-sm font-mono">#{String(pokemon.id).padStart(4, '0')}</p>
            <h2 className="text-3xl font-bold text-white capitalize">{pokemon.name.replace(/-/g, ' ')}</h2>
            <div className="flex gap-2 mt-1">{pokemon.types.map(t => <TypeBadge key={t} type={t} />)}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-800 rounded-xl p-3"><p className="text-xs text-gray-400">Height</p><p className="text-white font-bold">{(pokemon.height / 10).toFixed(1)}m</p></div>
            <div className="bg-gray-800 rounded-xl p-3"><p className="text-xs text-gray-400">Weight</p><p className="text-white font-bold">{(pokemon.weight / 10).toFixed(1)}kg</p></div>
            <div className="bg-gray-800 rounded-xl p-3"><p className="text-xs text-gray-400">BST</p><p className="text-white font-bold">{totalBase}</p></div>
          </div>

          <div>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Abilities</h3>
            <div className="flex gap-2 flex-wrap">
              {pokemon.abilities.map(a => (
                <span key={a.name} className={`px-3 py-1 rounded-lg text-sm capitalize ${a.isHidden ? 'bg-purple-900/50 text-purple-300 border border-purple-700' : 'bg-gray-800 text-gray-200'}`}>
                  {a.name.replace(/-/g, ' ')}{a.isHidden && <span className="ml-1 text-xs text-purple-400">(HA)</span>}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3">Base Stats</h3>
            <div className="space-y-2">{pokemon.stats.map(s => <StatBar key={s.name} name={s.name} value={s.base} />)}</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {weaknesses.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Weak to</h3>
                <div className="flex flex-wrap gap-1.5">
                  {weaknesses.map(([type, mult]) => (
                    <span key={type}><TypeBadge type={type} size="sm" /><span className="ml-0.5 text-xs text-red-400 font-bold">×{mult}</span></span>
                  ))}
                </div>
              </div>
            )}
            {resistances.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Resists</h3>
                <div className="flex flex-wrap gap-1.5">
                  {resistances.map(([type, mult]) => (
                    <span key={type}><TypeBadge type={type} size="sm" /><span className="ml-0.5 text-xs text-green-400 font-bold">×{mult}</span></span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleAddToTeam}
            disabled={activeTeam ? activeTeam.members.length >= 6 : false}
            className="w-full py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {activeTeam && activeTeam.members.length >= 6 ? 'Team Full (6/6)' : activeTeam ? `Add to "${activeTeam.name}"` : 'Add to New Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
