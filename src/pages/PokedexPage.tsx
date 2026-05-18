import { useState, useEffect, useCallback } from 'react';
import { PokemonCard } from '../components/pokedex/PokemonCard';
import { PokemonDetail } from '../components/pokedex/PokemonDetail';
import { Spinner } from '../components/ui/Spinner';
import { fetchGeneration, searchPokemon } from '../api/pokeapi';
import type { PokemonListItem, Pokemon } from '../api/pokeapi';
import { isChampionsEligible } from '../utils/championsRoster';

const GENERATIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PokedexPage() {
  const [list, setList] = useState<PokemonListItem[]>([]);
  const [filtered, setFiltered] = useState<PokemonListItem[]>([]);
  const [query, setQuery] = useState('');
  const [gen, setGen] = useState(1);
  const [championsOnly, setChampionsOnly] = useState(false);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGen(gen); }, [gen, loadGen]);

  useEffect(() => {
    let result = list;
    if (championsOnly) result = result.filter(p => isChampionsEligible(p.name));
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(p => p.name.includes(q) || String(p.id).includes(q));
    }
    setFiltered(result);
  }, [query, list, championsOnly]);

  async function handleCardClick(item: PokemonListItem) {
    setDetailLoading(true);
    const full = await searchPokemon(item.name);
    setSelected(full);
    setDetailLoading(false);
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero banner */}
      <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--line)', background: 'linear-gradient(135deg, var(--bg-1), var(--bg-0))', padding: '20px 0' }}>
        <div className="wrap-wide">
          <div style={{ position: 'relative' }}>
            {/* Corner accents */}
            <div style={{ position: 'absolute', top: -4, left: -4, width: 20, height: 20, borderTop: '1px solid var(--accent)', borderLeft: '1px solid var(--accent)' }} />
            <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderBottom: '1px solid var(--accent)', borderRight: '1px solid var(--accent)' }} />
            <div className="hud-label" style={{ marginBottom: 4 }}>// THE CODEX — MODULE 01</div>
            <h1 className="hud-title" style={{ margin: 0, fontSize: 32, lineHeight: 1 }}>
              <span style={{ color: 'var(--accent)' }}>POKÉ</span>DEX
              <span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 18, marginLeft: 12 }}>/ scouting</span>
            </h1>
            <p style={{ color: 'var(--text-2)', margin: '8px 0 0', fontSize: 12, maxWidth: 480 }}>
              Browse every creature, filter by generation or format. Click any card to drill into stats, abilities, and type matchups.
            </p>
          </div>
        </div>
      </div>

      {/* Sticky filter bar */}
      <div style={{ position: 'sticky', top: 48, zIndex: 20, background: 'rgba(7,8,11,.92)', backdropFilter: 'blur(8px)', borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
        <div className="wrap-wide">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Search */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-hard)', background: 'var(--bg-1)', padding: '0 10px', flex: '0 1 260px' }}>
              <svg width="12" height="12" viewBox="0 0 16 16" style={{ color: 'var(--text-3)', flexShrink: 0 }}>
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.5 10.5 L14 14" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              <input
                className="ipt"
                style={{ border: 0, background: 'transparent', padding: '7px 0', fontSize: 11 }}
                placeholder="Search name or #ID…"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <span className="mono" style={{ color: 'var(--text-3)', fontSize: 10, flexShrink: 0 }}>{filtered.length}</span>
            </div>

            {/* Champions toggle */}
            <button
              className={`pill champ ${championsOnly ? 'active' : ''}`}
              onClick={() => setChampionsOnly(v => !v)}
            >
              <span style={{ width: 5, height: 5, background: championsOnly ? 'var(--champ)' : 'var(--text-3)', display: 'inline-block', flexShrink: 0 }} />
              Champions
            </button>

            <div style={{ width: 1, height: 16, background: 'var(--line)' }} />

            {/* Gen filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="hud-label">GEN</span>
              <div className="seg">
                {GENERATIONS.map(g => (
                  <button
                    key={g}
                    className={gen === g ? 'active' : ''}
                    onClick={() => { setGen(g); setQuery(''); }}
                  >
                    <span className="mono">{g}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="wrap-wide" style={{ paddingTop: 20, paddingBottom: 48 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '80px 0' }}>
            <Spinner size={10} />
            <span className="hud-label">LOADING POKÉMON…</span>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
              {filtered.map(p => (
                <PokemonCard key={p.id} pokemon={p} onClick={() => handleCardClick(p)} />
              ))}
            </div>
            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-3)' }}>
                <span className="mono" style={{ fontSize: 12 }}>
                  {query ? `NO RESULTS FOR "${query.toUpperCase()}"` : championsOnly ? 'NO CHAMPIONS IN THIS GEN' : 'NO POKÉMON FOUND'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail slide-over loading overlay */}
      {detailLoading && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(7,8,11,.6)', backdropFilter: 'blur(4px)' }}>
          <Spinner size={10} />
        </div>
      )}
      {selected && !detailLoading && (
        <PokemonDetail pokemon={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
