import { useState, useEffect } from 'react';
import type { Pokemon } from '../../api/pokeapi';
import { fetchAbilityEffect } from '../../api/pokeapi';
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
  const totalBase = pokemon.stats.reduce((s, st) => s + st.base, 0);

  const [shiny, setShiny] = useState(false);
  const [added, setAdded] = useState(false);
  const [abilityEffects, setAbilityEffects] = useState<Record<string, string>>({});

  useEffect(() => {
    setAbilityEffects({});
    pokemon.abilities.forEach(a => {
      fetchAbilityEffect(a.name).then(effect => {
        setAbilityEffects(prev => ({ ...prev, [a.name]: effect }));
      });
    });
  }, [pokemon.id]);

  const normalArt = pokemon.sprites.other?.['official-artwork']?.front_default ?? pokemon.sprites.front_default;
  const shinyArt  = pokemon.sprites.other?.['official-artwork']?.front_shiny   ?? pokemon.sprites.front_shiny;
  const artwork   = shiny && shinyArt ? shinyArt : normalArt;

  function handleAddToTeam() {
    if (!activeTeamId) {
      const id = createTeam('My Team');
      useTeamStore.getState().addMember(id, pokemon);
    } else {
      addMember(activeTeamId, pokemon);
    }
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const weaknesses  = Object.entries(profile).filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]);
  const resistances = Object.entries(profile).filter(([, v]) => v < 1).sort((a, b) => a[1] - b[1]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-gray-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="relative h-48 rounded-t-3xl flex items-end px-6 pb-4" style={{ background: `linear-gradient(135deg, ${primaryColor}55, ${primaryColor}22)` }}>
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white text-2xl leading-none">×</button>

          {/* Shiny toggle */}
          {shinyArt && (
            <button
              onClick={() => setShiny(s => !s)}
              title="Toggle shiny"
              className={`absolute top-4 right-12 text-xs font-bold px-2 py-0.5 rounded-full border transition-colors ${
                shiny
                  ? 'bg-yellow-400/20 border-yellow-500 text-yellow-300'
                  : 'bg-gray-800/60 border-gray-600 text-gray-400 hover:text-yellow-300 hover:border-yellow-600'
              }`}
            >
              ✦ Shiny
            </button>
          )}

          <img
            src={artwork ?? ''}
            alt={pokemon.name}
            className={`absolute right-6 bottom-0 w-40 h-40 object-contain drop-shadow-2xl transition-all duration-300 ${
              shiny ? 'drop-shadow-[0_0_24px_rgba(250,204,21,0.45)]' : ''
            }`}
          />
          <div>
            <p className="text-gray-400 text-sm font-mono">#{String(pokemon.id).padStart(4, '0')}</p>
            <h2 className="text-3xl font-bold text-white capitalize">{pokemon.name.replace(/-/g, ' ')}</h2>
            <div className="flex gap-2 mt-1">{pokemon.types.map(t => <TypeBadge key={t} type={t} />)}</div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick info */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400">Height</p>
              <p className="text-white font-bold">{(pokemon.height / 10).toFixed(1)}m</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400">Weight</p>
              <p className="text-white font-bold">{(pokemon.weight / 10).toFixed(1)}kg</p>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-400">BST</p>
              <p className="text-white font-bold">{totalBase}</p>
            </div>
          </div>

          {/* Abilities */}
          <div>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Abilities</h3>
            <div className="space-y-2">
              {pokemon.abilities.map(a => (
                <div
                  key={a.name}
                  className={`px-3 py-2 rounded-xl ${a.isHidden ? 'bg-purple-900/30 border border-purple-700/50' : 'bg-gray-800 border border-gray-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold capitalize ${a.isHidden ? 'text-purple-200' : 'text-white'}`}>
                      {a.name.replace(/-/g, ' ')}
                    </span>
                    {a.isHidden && (
                      <span className="text-xs text-purple-400 bg-purple-900/60 px-1.5 py-0.5 rounded font-bold">HA</span>
                    )}
                  </div>
                  <p className={`text-xs mt-0.5 leading-relaxed ${abilityEffects[a.name] ? 'text-gray-400' : 'text-gray-600 animate-pulse'}`}>
                    {abilityEffects[a.name] ?? 'Loading…'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Base Stats */}
          <div>
            <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-3">Base Stats</h3>
            <div className="space-y-2">
              {pokemon.stats.map(s => <StatBar key={s.name} name={s.name} value={s.base} />)}
            </div>
          </div>

          {/* Type matchups */}
          <div className="grid grid-cols-2 gap-4">
            {weaknesses.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Weak to</h3>
                <div className="flex flex-wrap gap-1.5">
                  {weaknesses.map(([type, mult]) => (
                    <span key={type} className="flex items-center gap-0.5">
                      <TypeBadge type={type} size="sm" />
                      <span className="text-xs text-red-400 font-bold">×{mult}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {resistances.length > 0 && (
              <div>
                <h3 className="text-gray-400 text-xs uppercase font-bold tracking-wider mb-2">Resists</h3>
                <div className="flex flex-wrap gap-1.5">
                  {resistances.map(([type, mult]) => (
                    <span key={type} className="flex items-center gap-0.5">
                      <TypeBadge type={type} size="sm" />
                      <span className="text-xs text-green-400 font-bold">×{mult}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Add to team */}
          <button
            onClick={handleAddToTeam}
            disabled={!added && (activeTeam ? activeTeam.members.length >= 6 : false)}
            className={`w-full py-3 rounded-xl font-bold text-white transition-colors ${
              added
                ? 'bg-green-600 cursor-default'
                : 'bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed'
            }`}
          >
            {added
              ? '✓ Added to team!'
              : activeTeam && activeTeam.members.length >= 6
                ? 'Team Full (6/6)'
                : activeTeam
                  ? `Add to "${activeTeam.name}"`
                  : 'Add to New Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
