import { useState, useEffect, useMemo } from 'react';
import type { TeamMember } from '../../store/teamStore';
import type { InferredOpponent } from '../../utils/opponentInference';
import { makeSnapshot, calcDamage, weatherMoveMod } from '../../utils/damageCalc';
import type { MoveData, Weather } from '../../utils/damageCalc';
import { fetchMoveData } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { formatMoveName } from '../teambuilder/MoveInput';

interface Props {
  ourLeads: TeamMember[];
  theirLeads: InferredOpponent[];
  onBack: () => void;
  onReset: () => void;
}

interface FetchedMove {
  slug: string;
  displayName: string;
  move: MoveData;
}

interface PerDefender {
  defender: InferredOpponent;
  minPct: number;
  maxPct: number;
  effectiveness: number;
  stab: boolean;
}

interface MoveSuggestion {
  slug: string;
  displayName: string;
  move: MoveData;
  weatherNullified: boolean;
  results: PerDefender[];
  bestDamage: number;
  bestEffectiveness: number;
}

// ── Weather config ────────────────────────────────────────────────────────

const WEATHER_OPTIONS: { id: Weather; label: string; activeClass: string }[] = [
  { id: 'none',       label: 'Clear',        activeClass: 'bg-gray-600 border-gray-500 text-white' },
  { id: 'sun',        label: 'Harsh Sun',    activeClass: 'bg-yellow-600 border-yellow-500 text-white' },
  { id: 'rain',       label: 'Rain',         activeClass: 'bg-blue-600 border-blue-500 text-white' },
  { id: 'sand',       label: 'Sandstorm',    activeClass: 'bg-amber-700 border-amber-600 text-white' },
  { id: 'snow',       label: 'Snow',         activeClass: 'bg-cyan-600 border-cyan-500 text-white' },
  { id: 'extremesun', label: 'Extreme Sun',  activeClass: 'bg-orange-600 border-orange-500 text-white' },
  { id: 'heavyrain',  label: 'Heavy Rain',   activeClass: 'bg-indigo-700 border-indigo-600 text-white' },
];

/** Badge shown on the move card when weather modifies that move type. */
function weatherMoveBadge(weather: Weather, moveType: string): { text: string; cls: string } | null {
  const mod = weatherMoveMod(weather, moveType);
  if (mod === 1) return null;

  const weatherLabel: Partial<Record<Weather, string>> = {
    sun: 'Sun', rain: 'Rain', extremesun: 'Extreme Sun', heavyrain: 'Heavy Rain',
  };
  const label = weatherLabel[weather] ?? '';

  if (mod === 0) return { text: `${label} — Nullified`, cls: 'text-red-400 bg-red-900/40 border border-red-700/50' };
  if (mod > 1)   return { text: `${label} +50%`,        cls: 'text-emerald-300 bg-emerald-900/40 border border-emerald-700/50' };
  return           { text: `${label} -50%`,             cls: 'text-gray-400 bg-gray-900/40 border border-gray-700/50' };
}

/** Note shown on a defender when weather boosts their defensive stat for this move category. */
function weatherDefNote(
  weather: Weather,
  defTypes: string[],
  moveCategory: 'physical' | 'special' | 'status',
): string | null {
  if (weather === 'sand' && moveCategory === 'special' && defTypes.includes('rock')) return 'Sand: SpD ×1.5';
  if (weather === 'snow' && moveCategory === 'physical' && defTypes.includes('ice'))  return 'Snow: Def ×1.5';
  return null;
}

// ── Display helpers ───────────────────────────────────────────────────────

function pokeSprite(poke: {
  sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } };
}): string {
  return poke.sprites.other?.['official-artwork']?.front_default ?? poke.sprites.front_default ?? '';
}

function effCardClass(eff: number, nullified: boolean): string {
  if (nullified || eff === 0) return 'bg-gray-900/40 border-gray-800 opacity-40';
  if (eff >= 4) return 'bg-red-950/50 border-red-600/60';
  if (eff >= 2) return 'bg-orange-950/50 border-orange-500/60';
  if (eff < 1)  return 'bg-gray-800/50 border-gray-700';
  return 'bg-gray-800 border-gray-700';
}

function effLabel(eff: number): { text: string; cls: string } {
  if (eff === 0)   return { text: 'Immune',    cls: 'text-gray-600' };
  if (eff >= 4)    return { text: '4× Super!', cls: 'text-red-400 font-bold' };
  if (eff >= 2)    return { text: '2× Super',  cls: 'text-orange-400 font-semibold' };
  if (eff === 0.5) return { text: '½×',        cls: 'text-gray-500' };
  if (eff === 0.25)return { text: '¼×',        cls: 'text-gray-600' };
  return             { text: 'Neutral',        cls: 'text-gray-400' };
}

function damageBarClass(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 50)  return 'bg-orange-400';
  return 'bg-blue-400';
}

// ── Component ─────────────────────────────────────────────────────────────

export function MoveAdvisor({ ourLeads, theirLeads, onBack, onReset }: Props) {
  // Raw move data fetched once on mount
  const [fetchedMoves, setFetchedMoves] = useState<Map<string, FetchedMove[]>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [weather, setWeather]           = useState<Weather>('none');
  const [activeId, setActiveId]         = useState<string>('');

  useEffect(() => {
    if (ourLeads.length === 0 || theirLeads.length === 0) { setLoading(false); return; }
    void fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    const result = new Map<string, FetchedMove[]>();

    for (const attacker of ourLeads) {
      const moves: FetchedMove[] = [];
      for (const slug of attacker.moves) {
        if (!slug) continue;
        try {
          const move = await fetchMoveData(slug);
          moves.push({ slug, displayName: formatMoveName(slug), move });
        } catch { /* skip unknown move */ }
      }
      result.set(attacker.id, moves);
    }

    setFetchedMoves(result);
    setActiveId(ourLeads[0]?.id ?? '');
    setLoading(false);
  }

  // Recompute damage whenever weather or fetched moves change — no re-fetch needed
  const suggestions = useMemo<Map<string, MoveSuggestion[]>>(() => {
    const out = new Map<string, MoveSuggestion[]>();

    for (const attacker of ourLeads) {
      const fetched = fetchedMoves.get(attacker.id) ?? [];
      const attackerSnap = makeSnapshot(
        attacker.pokemon.name,
        attacker.pokemon.types,
        attacker.pokemon.stats,
        attacker.nature,
        attacker.evs,
        attacker.ivs,
      );

      const list: MoveSuggestion[] = fetched.map(fm => {
        const weatherNullified = weatherMoveMod(weather, fm.move.type) === 0;

        const results: PerDefender[] = theirLeads.map(opp => {
          const res = calcDamage(attackerSnap, fm.move, opp.snapshot, weather);
          return { defender: opp, minPct: res.minPct, maxPct: res.maxPct, effectiveness: res.effectiveness, stab: res.stab };
        });

        const bestDamage        = weatherNullified ? 0 : Math.max(0, ...results.map(r => r.maxPct));
        const bestEffectiveness = Math.max(0, ...results.map(r => r.effectiveness));

        return { slug: fm.slug, displayName: fm.displayName, move: fm.move, weatherNullified, results, bestDamage, bestEffectiveness };
      });

      list.sort((a, b) => {
        // Nullified / immune → last
        if ((a.weatherNullified || a.bestEffectiveness === 0) && !(b.weatherNullified || b.bestEffectiveness === 0)) return 1;
        if ((b.weatherNullified || b.bestEffectiveness === 0) && !(a.weatherNullified || a.bestEffectiveness === 0)) return -1;
        return b.bestDamage - a.bestDamage;
      });

      out.set(attacker.id, list);
    }

    return out;
  }, [fetchedMoves, weather, ourLeads, theirLeads]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <svg className="w-8 h-8 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-400 text-sm">Fetching move data…</p>
      </div>
    );
  }

  const attacker = ourLeads.find(a => a.id === activeId);
  const moves    = suggestions.get(activeId) ?? [];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-white font-bold text-lg">Move Suggestions</h2>
          <p className="text-gray-400 text-sm mt-1">
            Moves ranked by damage against opponent's leads. Toggle weather to see updated ranges instantly.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack}  className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">← Leads</button>
          <button onClick={onReset} className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">New Battle</button>
        </div>
      </div>

      {/* Weather selector */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Weather</p>
        <div className="flex gap-2 flex-wrap">
          {WEATHER_OPTIONS.map(w => (
            <button
              key={w.id}
              onClick={() => setWeather(w.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                weather === w.id
                  ? w.activeClass
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        {weather !== 'none' && (
          <div className="mt-3 text-xs text-gray-400 space-y-0.5">
            {weather === 'sun'        && <><p className="text-yellow-400">Fire moves: ×1.5</p><p className="text-blue-400/70">Water moves: ×0.5</p></>}
            {weather === 'extremesun' && <><p className="text-orange-400">Fire moves: ×1.5</p><p className="text-red-400">Water moves: Nullified (0 damage)</p></>}
            {weather === 'rain'       && <><p className="text-blue-400">Water moves: ×1.5</p><p className="text-orange-400/70">Fire moves: ×0.5</p></>}
            {weather === 'heavyrain'  && <><p className="text-blue-300">Water moves: ×1.5</p><p className="text-red-400">Fire moves: Nullified (0 damage)</p></>}
            {weather === 'sand'       && <p className="text-amber-400">Rock-type defenders: SpD ×1.5 vs special moves</p>}
            {weather === 'snow'       && <p className="text-cyan-400">Ice-type defenders: Def ×1.5 vs physical moves</p>}
          </div>
        )}
      </div>

      {/* Attacker tabs (doubles) */}
      {ourLeads.length > 1 && (
        <div className="flex gap-2">
          {ourLeads.map(lead => (
            <button
              key={lead.id}
              onClick={() => setActiveId(lead.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                activeId === lead.id
                  ? 'border-blue-500 bg-blue-950/30 text-white'
                  : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
              }`}
            >
              <img src={pokeSprite(lead.pokemon)} className="w-6 h-6 object-contain" alt="" />
              <span className="capitalize">{lead.nickname || lead.pokemon.name.replace(/-/g, ' ')}</span>
            </button>
          ))}
        </div>
      )}

      {/* Attacker + defender info bar */}
      {attacker && (
        <div className="flex items-center gap-3 bg-gray-800/60 rounded-xl p-3 border border-gray-700 flex-wrap">
          <img src={pokeSprite(attacker.pokemon)} className="w-12 h-12 object-contain" alt="" />
          <div>
            <div className="text-white font-bold capitalize">
              {attacker.nickname || attacker.pokemon.name.replace(/-/g, ' ')}
            </div>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {attacker.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {attacker.nature} · {attacker.evs.atk > attacker.evs.spa ? `Atk ${attacker.evs.atk}` : `SpA ${attacker.evs.spa}`} EVs
            </div>
          </div>
          <div className="text-xs text-gray-600 px-2">vs.</div>
          <div className="flex gap-3 flex-wrap">
            {theirLeads.map((opp, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <img src={pokeSprite(opp.pokemon)} className="w-10 h-10 object-contain" alt="" />
                <span className="text-xs text-gray-400 capitalize">{opp.pokemon.name.replace(/-/g, ' ')}</span>
                <span className="text-xs text-gray-600">{opp.nature}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Move cards */}
      {moves.length === 0 ? (
        <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center">
          <p className="text-gray-400">No moves configured for this Pokémon.</p>
          <p className="text-gray-600 text-sm mt-1">Add moves in Team Builder to get suggestions.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {moves.map((sug, idx) => {
            const wBadge = weatherMoveBadge(weather, sug.move.type);
            return (
              <div
                key={sug.slug}
                className={`rounded-2xl border p-4 transition-all ${effCardClass(sug.bestEffectiveness, sug.weatherNullified)}`}
              >
                {/* Move header */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-white font-bold">{sug.displayName}</span>
                  <TypeBadge type={sug.move.type} size="sm" />
                  <span className={`text-xs px-2 py-0.5 rounded-full border border-gray-700 bg-gray-900/50 ${
                    sug.move.category === 'physical' ? 'text-orange-300' :
                    sug.move.category === 'special'  ? 'text-blue-300'   : 'text-gray-400'
                  }`}>
                    {sug.move.category}
                  </span>
                  {sug.move.basePower > 0 && (
                    <span className="text-xs text-gray-500">{sug.move.basePower} BP</span>
                  )}
                  {/* Weather effect badge */}
                  {wBadge && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${wBadge.cls}`}>
                      {wBadge.text}
                    </span>
                  )}
                  {idx === 0 && moves.length > 1 && !sug.weatherNullified && sug.bestEffectiveness > 0 && (
                    <span className="ml-auto text-xs bg-yellow-900/60 text-yellow-400 border border-yellow-700/50 px-2 py-0.5 rounded-full font-bold">
                      Best Pick
                    </span>
                  )}
                </div>

                {/* Per-defender results */}
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${theirLeads.length}, 1fr)` }}
                >
                  {sug.results.map((res, ri) => {
                    const label   = effLabel(res.effectiveness);
                    const defNote = weatherDefNote(weather, res.defender.pokemon.types, sug.move.category);
                    const showDmg = !sug.weatherNullified && res.effectiveness > 0 && sug.move.basePower > 0;

                    return (
                      <div key={ri} className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/40">
                        <div className="flex items-center gap-1.5 mb-2">
                          <img src={pokeSprite(res.defender.pokemon)} className="w-5 h-5 object-contain" alt="" />
                          <span className="text-xs text-gray-400 capitalize truncate">
                            {res.defender.pokemon.name.replace(/-/g, ' ')}
                          </span>
                        </div>

                        <div className={`text-xs mb-1 ${label.cls}`}>{label.text}</div>

                        {sug.weatherNullified ? (
                          <div className="text-red-400/80 text-xs font-semibold">Nullified</div>
                        ) : showDmg ? (
                          <>
                            <div className="text-white font-mono text-sm font-bold">
                              {res.minPct}–{res.maxPct}%
                            </div>
                            <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${damageBarClass(res.maxPct)}`}
                                style={{ width: `${Math.min(res.maxPct, 100)}%` }}
                              />
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {res.minPct >= 100 && <span className="text-xs text-red-300 font-bold">Guaranteed KO</span>}
                              {res.minPct < 100 && res.maxPct >= 100 && <span className="text-xs text-red-400 font-bold">KO range!</span>}
                              {res.stab && <span className="text-xs text-yellow-500/80">STAB</span>}
                              {defNote && <span className="text-xs text-amber-400/70">{defNote}</span>}
                            </div>
                          </>
                        ) : (
                          <div className="text-gray-600 text-xs mt-1">No damage</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-800/40 rounded-2xl p-4 border border-gray-700/60">
        <p className="text-gray-500 text-xs">
          <span className="text-gray-400 font-semibold">Note:</span> Damage uses inferred competitive builds.
          Real results may differ based on actual spreads, held items, abilities, and multi-hit modifiers.
          Weather reflects field weather only — ability-based boosts (e.g. Solar Power, Chlorophyll) are not included.
        </p>
      </div>
    </div>
  );
}
