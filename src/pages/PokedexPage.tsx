import { useState, useEffect, useCallback } from 'react';
import { PokemonCard } from '../components/pokedex/PokemonCard';
import { PokemonDetail } from '../components/pokedex/PokemonDetail';
import { Spinner } from '../components/ui/Spinner';
import { fetchGeneration, searchPokemon } from '../api/pokeapi';
import type { PokemonListItem, Pokemon } from '../types/pokemon';

const GENERATIONS = [
  { label: 'Gen 1', value: 1 },
  { label: 'Gen 2', value: 2 },
  { label: 'Gen 3', value: 3 },
  { label: 'Gen 4', value: 4 },
  { label: 'Gen 5', value: 5 },
  { label: 'Gen 6', value: 6 },
  { label: 'Gen 7', value: 7 },
  { label: 'Gen 8', value: 8 },
  { label: 'Gen 9', value: 9 },
];

export function PokedexPage() {
  const [list, setList] = useState<PokemonListItem[]>([]);
  const [filtered, setFiltered] = useState<PokemonListItem[]>([]);
  const [query, setQuery] = useState('');
  const [gen, setGen] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Pokemon | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadGen = useCallback(async (g: number) => {
    setLoading(true);
    setList([]);
    setFiltered([]);
    try {
      const data = await fetchGeneration(g);
      setList(data);
      setFiltered(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGen(gen); }, [gen, loadGen]);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(list);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(list.filter(p => p.name.includes(q) || String(p.id).includes(q)));
  }, [query, list]);

  async function handleCardClick(item: PokemonListItem) {
    setDetailLoading(true);
    const full = await searchPokemon(item.name);
    setSelected(full);
    setDetailLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-red-900/30 to-gray-950 py-10 px-4 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-red-500">Poke</span>Codex
        </h1>
        <p className="text-gray-400 mt-1">Competitive-grade Pokédex for champion players</p>
      </div>

      {/* Controls */}
      <div className="sticky top-14 z-40 bg-gray-950/95 backdrop-blur border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or ID..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
          />
          <div className="flex gap-1 flex-wrap">
            {GENERATIONS.map(g => (
              <button
                key={g.value}
                onClick={() => { setGen(g.value); setQuery(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  gen === g.value
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Spinner size={12} />
            <p className="text-gray-500">Loading Pokémon...</p>
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">
              {filtered.length} Pokémon
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filtered.map(p => (
                <PokemonCard key={p.id} pokemon={p} onClick={() => handleCardClick(p)} />
              ))}
            </div>
            {filtered.length === 0 && !loading && (
              <div className="text-center py-20 text-gray-500">
                No Pokémon found for "{query}"
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {detailLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <Spinner size={12} />
        </div>
      )}
      {selected && !detailLoading && (
        <PokemonDetail pokemon={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
