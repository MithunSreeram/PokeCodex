import type { PokemonListItem } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { TYPE_COLORS } from '../../utils/typeColors';

interface Props {
  pokemon: PokemonListItem;
  onClick: () => void;
}

export function PokemonCard({ pokemon, onClick }: Props) {
  const primaryColor = TYPE_COLORS[pokemon.types[0]]?.bg ?? '#555';

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col items-center gap-2 rounded-2xl p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-gray-500 transition-all duration-200 hover:scale-105 cursor-pointer w-full"
    >
      <span className="absolute top-2 right-3 text-xs text-gray-500 font-mono">
        #{String(pokemon.id).padStart(4, '0')}
      </span>

      <div
        className="w-24 h-24 rounded-full flex items-center justify-center"
        style={{ background: `${primaryColor}22` }}
      >
        {pokemon.sprite ? (
          <img src={pokemon.sprite} alt={pokemon.name} className="w-20 h-20 object-contain drop-shadow-lg" loading="lazy" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-700 flex items-center justify-center text-3xl">?</div>
        )}
      </div>

      <span className="text-white font-semibold capitalize text-sm">
        {pokemon.name.replace(/-/g, ' ')}
      </span>

      <div className="flex gap-1 flex-wrap justify-center">
        {pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
      </div>
    </button>
  );
}
