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
  ourBench: TeamMember[];
  theirBench: InferredOpponent[];
  onSwitchOurLead: (outId: string, inId: string) => void;
  onSwitchTheirLead: (outName: string, inName: string) => void;
  onBack: () => void;
  onReset: () => void;
}

interface FetchedMove { slug: string; displayName: string; move: MoveData }
interface PerDefender  { defender: InferredOpponent; minPct: number; maxPct: number; effectiveness: number; stab: boolean }
interface MoveSuggestion {
  slug: string; displayName: string; move: MoveData;
  weatherNullified: boolean;
  results: PerDefender[];
  bestDamage: number; bestEffectiveness: number;
}

// All 5 in-battle stat stages per Pokémon (HP has no stage in Pokémon battles)
interface PokemonStages { atk: number; def: number; spa: number; spd: number; spe: number }
const defaultStages = (): PokemonStages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });

const STAGE_STATS: { key: keyof PokemonStages; label: string }[] = [
  { key: 'atk', label: 'Atk' },
  { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' },
  { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

// ── Weather config ────────────────────────────────────────────────────────

const WEATHER_OPTIONS: { id: Weather; label: string; activeClass: string }[] = [
  { id: 'none',       label: 'Clear',       activeClass: 'bg-gray-600 border-gray-500 text-white' },
  { id: 'sun',        label: 'Harsh Sun',   activeClass: 'bg-yellow-600 border-yellow-500 text-white' },
  { id: 'rain',       label: 'Rain',        activeClass: 'bg-blue-600 border-blue-500 text-white' },
  { id: 'sand',       label: 'Sandstorm',   activeClass: 'bg-amber-700 border-amber-600 text-white' },
  { id: 'snow',       label: 'Snow',        activeClass: 'bg-cyan-600 border-cyan-500 text-white' },
  { id: 'extremesun', label: 'Extreme Sun', activeClass: 'bg-orange-600 border-orange-500 text-white' },
  { id: 'heavyrain',  label: 'Heavy Rain',  activeClass: 'bg-indigo-700 border-indigo-600 text-white' },
];

function weatherMoveBadge(weather: Weather, moveType: string): { text: string; cls: string } | null {
  const mod = weatherMoveMod(weather, moveType);
  if (mod === 1) return null;
  const lbl: Partial<Record<Weather, string>> = { sun: 'Sun', rain: 'Rain', extremesun: 'Extreme Sun', heavyrain: 'Heavy Rain' };
  const l = lbl[weather] ?? '';
  if (mod === 0) return { text: `${l} — Nullified`, cls: 'text-red-400 bg-red-900/40 border border-red-700/50' };
  if (mod > 1)   return { text: `${l} +50%`,        cls: 'text-emerald-300 bg-emerald-900/40 border border-emerald-700/50' };
  return           { text: `${l} -50%`,             cls: 'text-gray-400 bg-gray-900/40 border border-gray-700/50' };
}

function weatherDefNote(weather: Weather, defTypes: string[], cat: 'physical' | 'special' | 'status'): string | null {
  if (weather === 'sand' && cat === 'special' && defTypes.includes('rock')) return 'Sand: SpD ×1.5';
  if (weather === 'snow' && cat === 'physical' && defTypes.includes('ice'))  return 'Snow: Def ×1.5';
  return null;
}

// ── Display helpers ───────────────────────────────────────────────────────

function pokeSprite(poke: { sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } } }): string {
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
  if (eff === 0)    return { text: 'Immune',    cls: 'text-gray-600' };
  if (eff >= 4)     return { text: '4× Super!', cls: 'text-red-400 font-bold' };
  if (eff >= 2)     return { text: '2× Super',  cls: 'text-orange-400 font-semibold' };
  if (eff === 0.5)  return { text: '½×',        cls: 'text-gray-500' };
  if (eff === 0.25) return { text: '¼×',        cls: 'text-gray-600' };
  return              { text: 'Neutral',        cls: 'text-gray-400' };
}

function damageBarClass(pct: number): string {
  if (pct >= 100) return 'bg-red-500';
  if (pct >= 50)  return 'bg-orange-400';
  return 'bg-blue-400';
}

// ── StageControl sub-component ────────────────────────────────────────────

function StageControl({ label, stage, onDec, onInc, onReset }: {
  label: string; stage: number;
  onDec: () => void; onInc: () => void; onReset: () => void;
}) {
  const numCls = stage > 0 ? 'text-green-400' : stage < 0 ? 'text-red-400' : 'text-gray-500';
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500 w-7 shrink-0">{label}</span>
      <button
        onClick={onDec} disabled={stage <= -6}
        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-white leading-none flex items-center justify-center text-sm transition-colors"
      >−</button>
      <button
        onClick={onReset}
        title={stage !== 0 ? 'Reset to 0' : undefined}
        className={`w-6 text-center text-xs font-mono font-bold transition-colors ${numCls} ${stage !== 0 ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}
      >
        {stage > 0 ? `+${stage}` : stage}
      </button>
      <button
        onClick={onInc} disabled={stage >= 6}
        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-white leading-none flex items-center justify-center text-sm transition-colors"
      >+</button>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function MoveAdvisor({ ourLeads, theirLeads, ourBench, theirBench, onSwitchOurLead, onSwitchTheirLead, onBack, onReset }: Props) {
  const [fetchedMoves, setFetchedMoves] = useState<Map<string, FetchedMove[]>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [weather, setWeather]           = useState<Weather>('none');
  const [activeId, setActiveId]         = useState<string>('');

  // All 5 stat stages for every Pokémon on the field
  const [ourStages,   setOurStages]   = useState<Map<string, PokemonStages>>(new Map());
  const [theirStages, setTheirStages] = useState<Map<number, PokemonStages>>(new Map());

  // Switch mechanism: pending bench mon to switch in (id for ours, name for theirs)
  const [pendingOurIn,   setPendingOurIn]   = useState<string | null>(null);
  const [pendingTheirIn, setPendingTheirIn] = useState<string | null>(null);

  useEffect(() => {
    if (ourLeads.length === 0 || theirLeads.length === 0) { setLoading(false); return; }
    void fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    const result = new Map<string, FetchedMove[]>();
    for (const attacker of [...ourLeads, ...ourBench]) {
      const moves: FetchedMove[] = [];
      for (const slug of attacker.moves) {
        if (!slug) continue;
        try { moves.push({ slug, displayName: formatMoveName(slug), move: await fetchMoveData(slug) }); }
        catch { /* skip */ }
      }
      result.set(attacker.id, moves);
    }
    setFetchedMoves(result);
    setActiveId(ourLeads[0]?.id ?? '');
    setLoading(false);
  }

  // ── Stage helpers ─────────────────────────────────────────────────────

  const getOurS   = (id: string) => ourStages.get(id)   ?? defaultStages();
  const getTheirS = (i: number)  => theirStages.get(i)  ?? defaultStages();

  function adjustOurS(id: string, stat: keyof PokemonStages, delta: number) {
    setOurStages(prev => {
      const m = new Map(prev); const cur = m.get(id) ?? defaultStages();
      m.set(id, { ...cur, [stat]: Math.max(-6, Math.min(6, cur[stat] + delta)) }); return m;
    });
  }
  function resetOurS(id: string, stat: keyof PokemonStages) {
    setOurStages(prev => { const m = new Map(prev); const cur = m.get(id) ?? defaultStages(); m.set(id, { ...cur, [stat]: 0 }); return m; });
  }
  function adjustTheirS(i: number, stat: keyof PokemonStages, delta: number) {
    setTheirStages(prev => {
      const m = new Map(prev); const cur = m.get(i) ?? defaultStages();
      m.set(i, { ...cur, [stat]: Math.max(-6, Math.min(6, cur[stat] + delta)) }); return m;
    });
  }
  function resetTheirS(i: number, stat: keyof PokemonStages) {
    setTheirStages(prev => { const m = new Map(prev); const cur = m.get(i) ?? defaultStages(); m.set(i, { ...cur, [stat]: 0 }); return m; });
  }

  // ── Switch helpers ────────────────────────────────────────────────────

  function doSwitchOur(slotIdx: number, outId: string, inId: string) {
    // Reset stages for the switched-out mon (real battle: stages clear on switch)
    setOurStages(prev => { const m = new Map(prev); m.delete(outId); return m; });
    if (activeId === outId) setActiveId(inId);
    setPendingOurIn(null);
    onSwitchOurLead(outId, inId);
  }

  function doSwitchTheir(slotIdx: number, outName: string, inName: string) {
    // Clear the slot's stages (slot index stays the same, new mon fills it fresh)
    setTheirStages(prev => { const m = new Map(prev); m.delete(slotIdx); return m; });
    setPendingTheirIn(null);
    onSwitchTheirLead(outName, inName);
  }

  // ── Damage calculation (reactive to weather + stages) ────────────────

  const suggestions = useMemo<Map<string, MoveSuggestion[]>>(() => {
    const out = new Map<string, MoveSuggestion[]>();

    for (const attacker of ourLeads) {
      const fetched = fetchedMoves.get(attacker.id) ?? [];
      const attackerSnap = makeSnapshot(
        attacker.pokemon.name, attacker.pokemon.types, attacker.pokemon.stats,
        attacker.nature, attacker.evs, attacker.ivs,
      );
      const atkS = ourStages.get(attacker.id) ?? { atk: 0, spa: 0 };

      const list: MoveSuggestion[] = fetched.map(fm => {
        const weatherNullified = weatherMoveMod(weather, fm.move.type) === 0;

        const results: PerDefender[] = theirLeads.map((opp, di) => {
          const defS = theirStages.get(di) ?? { def: 0, spd: 0 };
          const res = calcDamage(
            attackerSnap, fm.move, opp.snapshot, weather,
            atkS,  // uses .atk or .spa depending on move category
            defS,  // uses .def or .spd depending on move category
          );
          return { defender: opp, minPct: res.minPct, maxPct: res.maxPct, effectiveness: res.effectiveness, stab: res.stab };
        });

        const bestDamage        = weatherNullified ? 0 : Math.max(0, ...results.map(r => r.maxPct));
        const bestEffectiveness = Math.max(0, ...results.map(r => r.effectiveness));
        return { slug: fm.slug, displayName: fm.displayName, move: fm.move, weatherNullified, results, bestDamage, bestEffectiveness };
      });

      list.sort((a, b) => {
        const aSkip = a.weatherNullified || a.bestEffectiveness === 0;
        const bSkip = b.weatherNullified || b.bestEffectiveness === 0;
        if (aSkip && !bSkip) return 1;
        if (bSkip && !aSkip) return -1;
        return b.bestDamage - a.bestDamage;
      });

      out.set(attacker.id, list);
    }
    return out;
  }, [fetchedMoves, weather, ourLeads, theirLeads, ourStages, theirStages]);

  // ── Render ────────────────────────────────────────────────────────────

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
            Adjust weather and stat stages — damage ranges update instantly.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack}  className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">← Leads</button>
          <button onClick={onReset} className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">New Battle</button>
        </div>
      </div>

      {/* ── Weather selector ─────────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Weather</p>
        <div className="flex gap-2 flex-wrap">
          {WEATHER_OPTIONS.map(w => (
            <button key={w.id} onClick={() => setWeather(w.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                weather === w.id ? w.activeClass : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >{w.label}</button>
          ))}
        </div>
        {weather !== 'none' && (
          <div className="mt-3 text-xs space-y-0.5">
            {weather === 'sun'        && <><p className="text-yellow-400">Fire ×1.5</p><p className="text-blue-400/70">Water ×0.5</p></>}
            {weather === 'extremesun' && <><p className="text-orange-400">Fire ×1.5</p><p className="text-red-400">Water — Nullified</p></>}
            {weather === 'rain'       && <><p className="text-blue-400">Water ×1.5</p><p className="text-orange-400/70">Fire ×0.5</p></>}
            {weather === 'heavyrain'  && <><p className="text-blue-300">Water ×1.5</p><p className="text-red-400">Fire — Nullified</p></>}
            {weather === 'sand'       && <p className="text-amber-400">Rock: SpD ×1.5 vs special moves</p>}
            {weather === 'snow'       && <p className="text-cyan-400">Ice: Def ×1.5 vs physical moves</p>}
          </div>
        )}
      </div>

      {/* ── Switch panel ─────────────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Switch Pokémon</p>
        <div className="grid md:grid-cols-2 gap-5">

          {/* Our side */}
          <div>
            <p className="text-xs text-blue-300 font-semibold mb-2">Your Active</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {ourLeads.map((lead, slotIdx) => (
                <div key={lead.id}
                  onClick={pendingOurIn ? () => doSwitchOur(slotIdx, lead.id, pendingOurIn) : undefined}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all select-none ${
                    pendingOurIn
                      ? 'border-blue-400 bg-blue-950/30 cursor-pointer hover:bg-blue-900/40 ring-1 ring-blue-400/40'
                      : 'border-gray-600 bg-gray-700/40'
                  }`}
                >
                  <img src={pokeSprite(lead.pokemon)} className="w-10 h-10 object-contain" alt="" />
                  <span className="text-xs text-gray-200 capitalize mt-0.5 text-center max-w-[64px] leading-tight truncate">
                    {lead.nickname || lead.pokemon.name.replace(/-/g, ' ')}
                  </span>
                  {pendingOurIn && (
                    <span className="text-blue-400 text-[10px] mt-0.5 font-semibold">← replace</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1.5">Bench</p>
            <div className="flex gap-2 flex-wrap">
              {ourBench.length === 0 ? (
                <span className="text-xs text-gray-600 italic">No bench available</span>
              ) : ourBench.map(m => (
                <button key={m.id}
                  onClick={() => {
                    if (ourLeads.length === 1) {
                      doSwitchOur(0, ourLeads[0].id, m.id);
                    } else {
                      setPendingOurIn(prev => prev === m.id ? null : m.id);
                      setPendingTheirIn(null);
                    }
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    pendingOurIn === m.id
                      ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  <img src={pokeSprite(m.pokemon)} className="w-8 h-8 object-contain" alt="" />
                  <span className="text-[10px] capitalize text-center mt-0.5 max-w-[56px] leading-tight truncate">
                    {m.nickname || m.pokemon.name.replace(/-/g, ' ')}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-0.5">⇆ Switch in</span>
                </button>
              ))}
            </div>
            {pendingOurIn && ourLeads.length > 1 && (
              <p className="text-xs text-blue-400 mt-2">Click an active Pokémon above to swap it out</p>
            )}
          </div>

          {/* Their side */}
          <div>
            <p className="text-xs text-red-300 font-semibold mb-2">Their Active</p>
            <div className="flex gap-2 flex-wrap mb-3">
              {theirLeads.map((opp, slotIdx) => (
                <div key={opp.pokemon.name}
                  onClick={pendingTheirIn ? () => doSwitchTheir(slotIdx, opp.pokemon.name, pendingTheirIn) : undefined}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all select-none ${
                    pendingTheirIn
                      ? 'border-red-400 bg-red-950/30 cursor-pointer hover:bg-red-900/40 ring-1 ring-red-400/40'
                      : 'border-gray-600 bg-gray-700/40'
                  }`}
                >
                  <img src={pokeSprite(opp.pokemon)} className="w-10 h-10 object-contain" alt="" />
                  <span className="text-xs text-gray-200 capitalize mt-0.5 text-center max-w-[64px] leading-tight truncate">
                    {opp.pokemon.name.replace(/-/g, ' ')}
                  </span>
                  {pendingTheirIn && (
                    <span className="text-red-400 text-[10px] mt-0.5 font-semibold">← replace</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1.5">Bench</p>
            <div className="flex gap-2 flex-wrap">
              {theirBench.length === 0 ? (
                <span className="text-xs text-gray-600 italic">No bench available</span>
              ) : theirBench.map(opp => (
                <button key={opp.pokemon.name}
                  onClick={() => {
                    if (theirLeads.length === 1) {
                      doSwitchTheir(0, theirLeads[0].pokemon.name, opp.pokemon.name);
                    } else {
                      setPendingTheirIn(prev => prev === opp.pokemon.name ? null : opp.pokemon.name);
                      setPendingOurIn(null);
                    }
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                    pendingTheirIn === opp.pokemon.name
                      ? 'border-red-500 bg-red-950/40 text-red-300'
                      : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  <img src={pokeSprite(opp.pokemon)} className="w-8 h-8 object-contain" alt="" />
                  <span className="text-[10px] capitalize text-center mt-0.5 max-w-[56px] leading-tight truncate">
                    {opp.pokemon.name.replace(/-/g, ' ')}
                  </span>
                  <span className="text-[10px] text-gray-600 mt-0.5">⇆ Switch in</span>
                </button>
              ))}
            </div>
            {pendingTheirIn && theirLeads.length > 1 && (
              <p className="text-xs text-red-400 mt-2">Click an active Pokémon above to swap it out</p>
            )}
          </div>

        </div>
      </div>

      {/* ── Stat Stages panel ────────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Stat Stages</p>
          <button
            onClick={() => { setOurStages(new Map()); setTheirStages(new Map()); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >Reset all</button>
        </div>
        <p className="text-xs text-gray-600 mb-4">Click a stage number to reset it to 0. Changes apply instantly.</p>

        <div className="grid md:grid-cols-2 gap-5">

          {/* Our leads — all 5 stages */}
          <div>
            <p className="text-xs text-blue-300 font-semibold mb-3">Your Leads</p>
            <div className="space-y-4">
              {ourLeads.map(lead => {
                const s = getOurS(lead.id);
                return (
                  <div key={lead.id} className="flex items-start gap-2">
                    <img src={pokeSprite(lead.pokemon)} className="w-9 h-9 object-contain mt-0.5 shrink-0" alt="" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 capitalize truncate mb-1.5">
                        {lead.nickname || lead.pokemon.name.replace(/-/g, ' ')}
                      </p>
                      <div className="space-y-1.5">
                        {STAGE_STATS.map(({ key, label }) => (
                          <StageControl key={key} label={label} stage={s[key]}
                            onDec={() => adjustOurS(lead.id, key, -1)}
                            onInc={() => adjustOurS(lead.id, key,  1)}
                            onReset={() => resetOurS(lead.id, key)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Their leads — all 5 stages */}
          <div>
            <p className="text-xs text-red-300 font-semibold mb-3">Their Leads</p>
            <div className="space-y-4">
              {theirLeads.map((opp, i) => {
                const s = getTheirS(i);
                return (
                  <div key={i} className="flex items-start gap-2">
                    <img src={pokeSprite(opp.pokemon)} className="w-9 h-9 object-contain mt-0.5 shrink-0" alt="" />
                    <div className="min-w-0">
                      <p className="text-xs text-gray-300 capitalize truncate mb-1.5">
                        {opp.pokemon.name.replace(/-/g, ' ')}
                      </p>
                      <div className="space-y-1.5">
                        {STAGE_STATS.map(({ key, label }) => (
                          <StageControl key={key} label={label} stage={s[key]}
                            onDec={() => adjustTheirS(i, key, -1)}
                            onInc={() => adjustTheirS(i, key,  1)}
                            onReset={() => resetTheirS(i, key)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Attacker tabs (doubles) */}
      {ourLeads.length > 1 && (
        <div className="flex gap-2">
          {ourLeads.map(lead => (
            <button key={lead.id} onClick={() => setActiveId(lead.id)}
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
            {/* Active stage badges for attacker */}
            {(getOurS(attacker.id).atk !== 0 || getOurS(attacker.id).spa !== 0) && (
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {getOurS(attacker.id).atk !== 0 && (
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-700 ${getOurS(attacker.id).atk > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    Atk {getOurS(attacker.id).atk > 0 ? '+' : ''}{getOurS(attacker.id).atk}
                  </span>
                )}
                {getOurS(attacker.id).spa !== 0 && (
                  <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-700 ${getOurS(attacker.id).spa > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    SpA {getOurS(attacker.id).spa > 0 ? '+' : ''}{getOurS(attacker.id).spa}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-600 px-2">vs.</div>
          <div className="flex gap-3 flex-wrap">
            {theirLeads.map((opp, i) => {
              const s = getTheirS(i);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <img src={pokeSprite(opp.pokemon)} className="w-10 h-10 object-contain" alt="" />
                  <span className="text-xs text-gray-400 capitalize">{opp.pokemon.name.replace(/-/g, ' ')}</span>
                  <span className="text-xs text-gray-600">{opp.nature}</span>
                  {/* Active stage badges for defender */}
                  {(s.def !== 0 || s.spd !== 0) && (
                    <div className="flex gap-1 flex-wrap justify-center">
                      {s.def !== 0 && (
                        <span className={`text-xs font-mono font-bold px-1 rounded bg-gray-700 ${s.def > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                          Def{s.def > 0 ? '+' : ''}{s.def}
                        </span>
                      )}
                      {s.spd !== 0 && (
                        <span className={`text-xs font-mono font-bold px-1 rounded bg-gray-700 ${s.spd > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                          SpD{s.spd > 0 ? '+' : ''}{s.spd}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
              <div key={sug.slug} className={`rounded-2xl border p-4 transition-all ${effCardClass(sug.bestEffectiveness, sug.weatherNullified)}`}>

                {/* Move header */}
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <span className="text-white font-bold">{sug.displayName}</span>
                  <TypeBadge type={sug.move.type} size="sm" />
                  <span className={`text-xs px-2 py-0.5 rounded-full border border-gray-700 bg-gray-900/50 ${
                    sug.move.category === 'physical' ? 'text-orange-300' :
                    sug.move.category === 'special'  ? 'text-blue-300'   : 'text-gray-400'
                  }`}>{sug.move.category}</span>
                  {sug.move.basePower > 0 && <span className="text-xs text-gray-500">{sug.move.basePower} BP</span>}
                  {wBadge && <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${wBadge.cls}`}>{wBadge.text}</span>}
                  {idx === 0 && moves.length > 1 && !sug.weatherNullified && sug.bestEffectiveness > 0 && (
                    <span className="ml-auto text-xs bg-yellow-900/60 text-yellow-400 border border-yellow-700/50 px-2 py-0.5 rounded-full font-bold">Best Pick</span>
                  )}
                </div>

                {/* Per-defender results */}
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${theirLeads.length}, 1fr)` }}>
                  {sug.results.map((res, ri) => {
                    const label   = effLabel(res.effectiveness);
                    const defNote = weatherDefNote(weather, res.defender.pokemon.types, sug.move.category);
                    const defS    = getTheirS(ri);
                    const showDmg = !sug.weatherNullified && res.effectiveness > 0 && sug.move.basePower > 0;
                    const relevantStage = sug.move.category === 'physical' ? defS.def : sug.move.category === 'special' ? defS.spd : 0;

                    return (
                      <div key={ri} className="bg-gray-900/60 rounded-xl p-3 border border-gray-700/40">
                        <div className="flex items-center gap-1.5 mb-2">
                          <img src={pokeSprite(res.defender.pokemon)} className="w-5 h-5 object-contain" alt="" />
                          <span className="text-xs text-gray-400 capitalize truncate">{res.defender.pokemon.name.replace(/-/g, ' ')}</span>
                        </div>
                        <div className={`text-xs mb-1 ${label.cls}`}>{label.text}</div>

                        {sug.weatherNullified ? (
                          <div className="text-red-400/80 text-xs font-semibold">Nullified</div>
                        ) : showDmg ? (
                          <>
                            <div className="text-white font-mono text-sm font-bold">{res.minPct}–{res.maxPct}%</div>
                            <div className="mt-1.5 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${damageBarClass(res.maxPct)}`} style={{ width: `${Math.min(res.maxPct, 100)}%` }} />
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {res.minPct >= 100 && <span className="text-xs text-red-300 font-bold">Guaranteed KO</span>}
                              {res.minPct < 100 && res.maxPct >= 100 && <span className="text-xs text-red-400 font-bold">KO range!</span>}
                              {res.stab && <span className="text-xs text-yellow-500/80">STAB</span>}
                              {defNote && <span className="text-xs text-amber-400/70">{defNote}</span>}
                              {relevantStage !== 0 && (
                                <span className={`text-xs font-mono font-bold ${relevantStage > 0 ? 'text-orange-400/80' : 'text-green-400/80'}`}>
                                  {sug.move.category === 'physical' ? 'Def' : 'SpD'}{relevantStage > 0 ? '+' : ''}{relevantStage}
                                </span>
                              )}
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
          Weather reflects field weather only — ability-based boosts (e.g. Solar Power) are not included.
        </p>
      </div>
    </div>
  );
}
