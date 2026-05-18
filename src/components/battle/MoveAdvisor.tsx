import { useState, useEffect, useMemo } from 'react';
import type { TeamMember } from '../../store/teamStore';
import type { InferredOpponent } from '../../utils/opponentInference';
import { makeSnapshot, calcDamage, weatherMoveMod, terrainMoveMod } from '../../utils/damageCalc';
import type { MoveData, Weather, Terrain, AttackerItem } from '../../utils/damageCalc';
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
interface PerDefender {
  defender: InferredOpponent;
  minPct: number; maxPct: number;
  effectiveness: number; stab: boolean;
  rolls: number[]; koPct: number;
}
interface MoveSuggestion {
  slug: string; displayName: string; move: MoveData;
  weatherNullified: boolean;
  results: PerDefender[];
  bestDamage: number; bestEffectiveness: number; bestKoPct: number;
}

interface PokemonStages { atk: number; def: number; spa: number; spd: number; spe: number }
const defaultStages = (): PokemonStages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const STAGE_STATS: { key: keyof PokemonStages; label: string }[] = [
  { key: 'atk', label: 'Atk' }, { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' }, { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

const ITEM_OPTIONS: { value: AttackerItem; label: string }[] = [
  { value: 'none',         label: 'No Item' },
  { value: 'life-orb',     label: 'Life Orb ×1.3' },
  { value: 'choice-band',  label: 'Choice Band ×1.5 Phys' },
  { value: 'choice-specs', label: 'Choice Specs ×1.5 Spec' },
  { value: 'muscle-band',  label: 'Muscle Band ×1.1 Phys' },
  { value: 'wise-glasses', label: 'Wise Glasses ×1.1 Spec' },
  { value: 'expert-belt',  label: 'Expert Belt ×1.2 SE' },
];

const WEATHER_OPTIONS: { id: Weather; label: string; on: string }[] = [
  { id: 'none',       label: 'None',        on: 'bg-gray-600 text-white border-gray-500' },
  { id: 'sun',        label: 'Sun',         on: 'bg-yellow-600 text-white border-yellow-500' },
  { id: 'rain',       label: 'Rain',        on: 'bg-blue-600 text-white border-blue-500' },
  { id: 'sand',       label: 'Sand',        on: 'bg-amber-700 text-white border-amber-600' },
  { id: 'snow',       label: 'Snow',        on: 'bg-cyan-600 text-white border-cyan-500' },
  { id: 'extremesun', label: 'Ext. Sun',    on: 'bg-orange-600 text-white border-orange-500' },
  { id: 'heavyrain',  label: 'H. Rain',     on: 'bg-indigo-700 text-white border-indigo-600' },
];

const TERRAIN_OPTIONS: { id: Terrain; label: string; on: string }[] = [
  { id: 'none',     label: 'None',    on: 'bg-gray-600 text-white border-gray-500' },
  { id: 'electric', label: 'Elec',   on: 'bg-yellow-500 text-black border-yellow-400' },
  { id: 'grassy',   label: 'Grass',  on: 'bg-green-600 text-white border-green-500' },
  { id: 'psychic',  label: 'Psych',  on: 'bg-pink-600 text-white border-pink-500' },
  { id: 'misty',    label: 'Misty',  on: 'bg-purple-500 text-white border-purple-400' },
];

const OFF = 'bg-gray-900 text-gray-400 border-gray-700 hover:border-gray-500';

function pokeSprite(poke: { sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } } }): string {
  return poke.sprites.other?.['official-artwork']?.front_default ?? poke.sprites.front_default ?? '';
}

function StageRow({ label, stage, onDec, onInc, onReset }: {
  label: string; stage: number; onDec: () => void; onInc: () => void; onReset: () => void;
}) {
  const col = stage > 0 ? 'text-green-400' : stage < 0 ? 'text-red-400' : 'text-gray-500';
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-[11px] text-gray-500 w-6 shrink-0">{label}</span>
      <button onClick={onDec} disabled={stage <= -6}
        className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-20 text-gray-300 text-xs leading-none flex items-center justify-center">−</button>
      <button onClick={onReset} className={`w-5 text-center text-[11px] font-mono font-bold ${col} ${stage !== 0 ? 'cursor-pointer hover:text-white' : 'cursor-default'}`}>
        {stage > 0 ? `+${stage}` : stage}
      </button>
      <button onClick={onInc} disabled={stage >= 6}
        className="w-4 h-4 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-20 text-gray-300 text-xs leading-none flex items-center justify-center">+</button>
    </div>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${on ? 'bg-slate-600 text-white border-slate-500' : OFF}`}>
      {children}
    </button>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function MoveAdvisor({ ourLeads, theirLeads, ourBench, theirBench, onSwitchOurLead, onSwitchTheirLead, onBack, onReset }: Props) {
  const isDoubles = ourLeads.length > 1;

  const [fetchedMoves, setFetchedMoves] = useState<Map<string, FetchedMove[]>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [activeId, setActiveId]         = useState<string>('');

  const [weather,     setWeather]     = useState<Weather>('none');
  const [terrain,     setTerrain]     = useState<Terrain>('none');
  const [reflect,     setReflect]     = useState(false);
  const [lightScreen, setLightScreen] = useState(false);
  const [auroraVeil,  setAuroraVeil]  = useState(false);
  const [isCrit,      setIsCrit]      = useState(false);
  const [isSpread,    setIsSpread]    = useState(false);

  const [ourStages,   setOurStages]   = useState<Map<string, PokemonStages>>(new Map());
  const [theirStages, setTheirStages] = useState<Map<number, PokemonStages>>(new Map());
  const [burnedLeads, setBurnedLeads] = useState<Set<string>>(new Set());
  const [helpingHand, setHelpingHand] = useState<Set<string>>(new Set());
  const [ourItems,    setOurItems]    = useState<Map<string, AttackerItem>>(new Map());

  const [pendingOurIn,   setPendingOurIn]   = useState<string | null>(null);
  const [pendingTheirIn, setPendingTheirIn] = useState<string | null>(null);
  const [expandedRolls,  setExpandedRolls]  = useState<Set<string>>(new Set());

  useEffect(() => {
    if (ourLeads.length === 0 || theirLeads.length === 0) { setLoading(false); return; }
    void fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchAll() {
    setLoading(true);
    const result = new Map<string, FetchedMove[]>();
    for (const atk of [...ourLeads, ...ourBench]) {
      const moves: FetchedMove[] = [];
      for (const slug of atk.moves) {
        if (!slug) continue;
        try { moves.push({ slug, displayName: formatMoveName(slug), move: await fetchMoveData(slug) }); }
        catch { /* skip */ }
      }
      result.set(atk.id, moves);
    }
    setFetchedMoves(result);
    setActiveId(ourLeads[0]?.id ?? '');
    setLoading(false);
  }

  const getOurS   = (id: string) => ourStages.get(id)  ?? defaultStages();
  const getTheirS = (i: number)  => theirStages.get(i) ?? defaultStages();

  function adjustOurS(id: string, stat: keyof PokemonStages, delta: number) {
    setOurStages(prev => { const m = new Map(prev); const c = m.get(id) ?? defaultStages(); m.set(id, { ...c, [stat]: Math.max(-6, Math.min(6, c[stat] + delta)) }); return m; });
  }
  function resetOurS(id: string, stat: keyof PokemonStages) {
    setOurStages(prev => { const m = new Map(prev); const c = m.get(id) ?? defaultStages(); m.set(id, { ...c, [stat]: 0 }); return m; });
  }
  function adjustTheirS(i: number, stat: keyof PokemonStages, delta: number) {
    setTheirStages(prev => { const m = new Map(prev); const c = m.get(i) ?? defaultStages(); m.set(i, { ...c, [stat]: Math.max(-6, Math.min(6, c[stat] + delta)) }); return m; });
  }
  function resetTheirS(i: number, stat: keyof PokemonStages) {
    setTheirStages(prev => { const m = new Map(prev); const c = m.get(i) ?? defaultStages(); m.set(i, { ...c, [stat]: 0 }); return m; });
  }

  function doSwitchOur(slotIdx: number, outId: string, inId: string) {
    setOurStages(prev => { const m = new Map(prev); m.delete(outId); return m; });
    if (activeId === outId) setActiveId(inId);
    setPendingOurIn(null);
    onSwitchOurLead(outId, inId);
  }
  function doSwitchTheir(slotIdx: number, outName: string, inName: string) {
    setTheirStages(prev => { const m = new Map(prev); m.delete(slotIdx); return m; });
    setPendingTheirIn(null);
    onSwitchTheirLead(outName, inName);
  }

  const suggestions = useMemo<Map<string, MoveSuggestion[]>>(() => {
    const out = new Map<string, MoveSuggestion[]>();
    for (const attacker of ourLeads) {
      const fetched      = fetchedMoves.get(attacker.id) ?? [];
      const attackerSnap = makeSnapshot(
        attacker.pokemon.name, attacker.pokemon.types, attacker.pokemon.stats,
        attacker.nature, attacker.evs, attacker.ivs,
      );
      const atkS = ourStages.get(attacker.id) ?? defaultStages();
      const list: MoveSuggestion[] = fetched.map(fm => {
        const weatherNullified = weatherMoveMod(weather, fm.move.type) === 0;
        const results: PerDefender[] = theirLeads.map((opp, di) => {
          const defS = theirStages.get(di) ?? defaultStages();
          const res  = calcDamage(attackerSnap, fm.move, opp.snapshot, weather, atkS, defS, {
            terrain, isCrit, isSpread,
            isHelpingHand: helpingHand.has(attacker.id),
            isBurned: burnedLeads.has(attacker.id),
            reflect, lightScreen, auroraVeil,
            attackerItem: ourItems.get(attacker.id) ?? 'none',
            isDoubles,
          });
          return { defender: opp, minPct: res.minPct, maxPct: res.maxPct, effectiveness: res.effectiveness, stab: res.stab, rolls: res.rolls, koPct: res.koPct };
        });
        const bestDamage        = weatherNullified ? 0 : Math.max(0, ...results.map(r => r.maxPct));
        const bestEffectiveness = Math.max(0, ...results.map(r => r.effectiveness));
        const bestKoPct         = Math.max(0, ...results.map(r => r.koPct));
        return { slug: fm.slug, displayName: fm.displayName, move: fm.move, weatherNullified, results, bestDamage, bestEffectiveness, bestKoPct };
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
  }, [fetchedMoves, weather, terrain, isCrit, isSpread, reflect, lightScreen, auroraVeil,
      ourLeads, theirLeads, ourStages, theirStages, burnedLeads, helpingHand, ourItems, isDoubles]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <svg className="w-7 h-7 animate-spin text-red-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-gray-400 text-sm">Fetching move data…</p>
      </div>
    );
  }

  const attacker = ourLeads.find(a => a.id === activeId);
  const moves    = suggestions.get(activeId) ?? [];

  // Grid template for move table (name + type + cat + bp + N defenders)
  const moveCols = `minmax(120px,1fr) 60px 46px 32px ${theirLeads.map(() => 'minmax(100px,1fr)').join(' ')}`;

  return (
    <div className="space-y-3">

      {/* ── Top bar ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Move Advisor</h2>
        <div className="flex gap-2">
          <button onClick={onBack}  className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-xs transition-colors">← Leads</button>
          <button onClick={onReset} className="px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-xs transition-colors">New Battle</button>
        </div>
      </div>

      {/* ── Field Conditions ─────────────────────────────────────────── */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 space-y-2">
        <div className="flex flex-wrap gap-x-5 gap-y-2">

          {/* Weather */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide w-14 shrink-0">Weather</span>
            {WEATHER_OPTIONS.map(w => (
              <button key={w.id} onClick={() => setWeather(w.id)}
                className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${weather === w.id ? w.on : OFF}`}>
                {w.label}
              </button>
            ))}
          </div>

          {/* Terrain */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide w-14 shrink-0">Terrain</span>
            {TERRAIN_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTerrain(t.id)}
                className={`px-2 py-0.5 rounded text-xs font-semibold border transition-all ${terrain === t.id ? t.on : OFF}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Screens + modifiers */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide w-14 shrink-0">Mods</span>
            <Pill on={reflect}     onClick={() => setReflect(v => !v)}>Reflect</Pill>
            <Pill on={lightScreen} onClick={() => setLightScreen(v => !v)}>Light Screen</Pill>
            <Pill on={auroraVeil}  onClick={() => setAuroraVeil(v => !v)}>Aurora Veil</Pill>
            <Pill on={isCrit}      onClick={() => setIsCrit(v => !v)}>Crit ×1.5</Pill>
            {isDoubles && <Pill on={isSpread} onClick={() => setIsSpread(v => !v)}>Spread ×0.75</Pill>}
          </div>
        </div>

        {/* Active condition notes */}
        {(weather !== 'none' || terrain !== 'none' || reflect || lightScreen || auroraVeil || isCrit) && (
          <div className="flex gap-3 flex-wrap pt-1 border-t border-gray-700/60">
            {weather === 'sun'        && <><span className="text-xs text-yellow-400">Fire ×1.5</span><span className="text-xs text-blue-400/70">Water ×0.5</span></>}
            {weather === 'extremesun' && <><span className="text-xs text-orange-400">Fire ×1.5</span><span className="text-xs text-red-400">Water nullified</span></>}
            {weather === 'rain'       && <><span className="text-xs text-blue-400">Water ×1.5</span><span className="text-xs text-orange-400/70">Fire ×0.5</span></>}
            {weather === 'heavyrain'  && <><span className="text-xs text-blue-300">Water ×1.5</span><span className="text-xs text-red-400">Fire nullified</span></>}
            {weather === 'sand'       && <span className="text-xs text-amber-400">Rock SpD ×1.5</span>}
            {weather === 'snow'       && <span className="text-xs text-cyan-400">Ice Def ×1.5</span>}
            {terrain === 'electric'   && <span className="text-xs text-yellow-400">Electric ×1.3</span>}
            {terrain === 'grassy'     && <span className="text-xs text-green-400">Grass ×1.3 · EQ ×0.5</span>}
            {terrain === 'psychic'    && <span className="text-xs text-pink-400">Psychic ×1.3</span>}
            {terrain === 'misty'      && <span className="text-xs text-purple-400">Dragon ×0.5</span>}
            {(reflect || auroraVeil)  && <span className="text-xs text-slate-400">Reflect active</span>}
            {(lightScreen || auroraVeil) && <span className="text-xs text-slate-400">Light Screen active</span>}
            {isCrit                   && <span className="text-xs text-orange-400">Crit: ignores def boosts & screens</span>}
          </div>
        )}
      </div>

      {/* ── Battlers ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3">

        {/* Our side */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-blue-400 font-semibold uppercase tracking-wide">Your Lead</span>
            {/* Lead tabs for doubles */}
            {ourLeads.length > 1 && (
              <div className="flex gap-1">
                {ourLeads.map(lead => (
                  <button key={lead.id} onClick={() => setActiveId(lead.id)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border transition-all ${
                      activeId === lead.id ? 'border-blue-500 bg-blue-950/40 text-white' : 'border-gray-600 bg-gray-700/40 text-gray-400 hover:text-white'
                    }`}>
                    <img src={pokeSprite(lead.pokemon)} className="w-4 h-4 object-contain" alt="" />
                    <span className="capitalize">{(lead.nickname || lead.pokemon.name).split('-')[0]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {attacker && (
            <>
              {/* Pokémon identity */}
              <div className="flex items-center gap-2 mb-3">
                <img src={pokeSprite(attacker.pokemon)} className="w-14 h-14 object-contain shrink-0" alt="" />
                <div className="min-w-0">
                  <div className="text-white font-semibold capitalize text-sm leading-tight truncate">
                    {attacker.nickname || attacker.pokemon.name.replace(/-/g, ' ')}
                  </div>
                  <div className="flex gap-1 mt-0.5 flex-wrap">
                    {attacker.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{attacker.nature} nature</div>
                </div>
              </div>

              {/* Stat stages — 2-col */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3">
                {STAGE_STATS.map(({ key, label }) => (
                  <StageRow key={key} label={label} stage={getOurS(attacker.id)[key]}
                    onDec={() => adjustOurS(attacker.id, key, -1)}
                    onInc={() => adjustOurS(attacker.id, key,  1)}
                    onReset={() => resetOurS(attacker.id, key)} />
                ))}
              </div>

              {/* Options */}
              <div className="space-y-1.5 pt-2 border-t border-gray-700/50">
                <div className="flex gap-3 flex-wrap">
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] text-gray-400 hover:text-white transition-colors">
                    <input type="checkbox" checked={burnedLeads.has(attacker.id)}
                      onChange={() => setBurnedLeads(prev => { const s = new Set(prev); burnedLeads.has(attacker.id) ? s.delete(attacker.id) : s.add(attacker.id); return s; })}
                      className="accent-red-500 w-3 h-3" />
                    Burned
                  </label>
                  {isDoubles && (
                    <label className="flex items-center gap-1 cursor-pointer text-[11px] text-gray-400 hover:text-white transition-colors">
                      <input type="checkbox" checked={helpingHand.has(attacker.id)}
                        onChange={() => setHelpingHand(prev => { const s = new Set(prev); helpingHand.has(attacker.id) ? s.delete(attacker.id) : s.add(attacker.id); return s; })}
                        className="accent-purple-500 w-3 h-3" />
                      Helping Hand
                    </label>
                  )}
                </div>
                <select value={ourItems.get(attacker.id) ?? 'none'}
                  onChange={e => setOurItems(prev => { const m = new Map(prev); m.set(attacker.id, e.target.value as AttackerItem); return m; })}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-[11px] text-gray-300 focus:outline-none focus:border-gray-500">
                  {ITEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Our bench */}
          {ourBench.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700/40">
              <span className="text-[11px] text-gray-600 font-medium">Bench · click to switch in</span>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {ourBench.map(m => (
                  <button key={m.id}
                    onClick={() => {
                      if (ourLeads.length === 1) doSwitchOur(0, ourLeads[0].id, m.id);
                      else { setPendingOurIn(prev => prev === m.id ? null : m.id); setPendingTheirIn(null); }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-all ${
                      pendingOurIn === m.id
                        ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                        : 'border-gray-700 bg-gray-700/40 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}>
                    <img src={pokeSprite(m.pokemon)} className="w-5 h-5 object-contain" alt="" />
                    <span className="capitalize">{(m.nickname || m.pokemon.name).split('-')[0]}</span>
                    <span className="text-gray-600 text-xs">⇆</span>
                  </button>
                ))}
              </div>
              {pendingOurIn && ourLeads.length > 1 && (
                <p className="text-[11px] text-blue-400 mt-1">Now click the lead above to replace</p>
              )}
              {/* Pending switch: highlight active leads */}
              {pendingOurIn && ourLeads.length > 1 && (
                <div className="flex gap-1.5 mt-1">
                  {ourLeads.map((lead, si) => (
                    <button key={lead.id} onClick={() => doSwitchOur(si, lead.id, pendingOurIn)}
                      className="flex items-center gap-1 px-2 py-1 rounded border border-blue-400 bg-blue-950/30 text-blue-200 text-[11px] hover:bg-blue-900/40">
                      <img src={pokeSprite(lead.pokemon)} className="w-4 h-4 object-contain" alt="" />
                      <span className="capitalize">{(lead.nickname || lead.pokemon.name).split('-')[0]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Their side */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-3">
          <span className="text-[11px] text-red-400 font-semibold uppercase tracking-wide">Their Lead{theirLeads.length > 1 ? 's' : ''}</span>

          <div className={`mt-2 grid gap-3 ${theirLeads.length > 1 ? 'grid-cols-2' : ''}`}>
            {theirLeads.map((opp, i) => {
              const s = getTheirS(i);
              return (
                <div key={i}>
                  <div className="flex items-center gap-2 mb-2">
                    <img src={pokeSprite(opp.pokemon)} className="w-12 h-12 object-contain shrink-0" alt="" />
                    <div className="min-w-0">
                      <div className="text-white font-semibold capitalize text-sm leading-tight truncate">
                        {opp.pokemon.name.replace(/-/g, ' ')}
                      </div>
                      <div className="flex gap-0.5 mt-0.5 flex-wrap">
                        {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{opp.nature} · {opp.role}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                    {STAGE_STATS.map(({ key, label }) => (
                      <StageRow key={key} label={label} stage={s[key]}
                        onDec={() => adjustTheirS(i, key, -1)}
                        onInc={() => adjustTheirS(i, key,  1)}
                        onReset={() => resetTheirS(i, key)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Their bench */}
          {theirBench.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-700/40">
              <span className="text-[11px] text-gray-600 font-medium">Bench · click to switch in</span>
              <div className="flex gap-1.5 flex-wrap mt-1">
                {theirBench.map(opp => (
                  <button key={opp.pokemon.name}
                    onClick={() => {
                      if (theirLeads.length === 1) doSwitchTheir(0, theirLeads[0].pokemon.name, opp.pokemon.name);
                      else { setPendingTheirIn(prev => prev === opp.pokemon.name ? null : opp.pokemon.name); setPendingOurIn(null); }
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded border text-[11px] transition-all ${
                      pendingTheirIn === opp.pokemon.name
                        ? 'border-red-500 bg-red-950/40 text-red-300'
                        : 'border-gray-700 bg-gray-700/40 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}>
                    <img src={pokeSprite(opp.pokemon)} className="w-5 h-5 object-contain" alt="" />
                    <span className="capitalize">{opp.pokemon.name.split('-')[0]}</span>
                    <span className="text-gray-600 text-xs">⇆</span>
                  </button>
                ))}
              </div>
              {pendingTheirIn && theirLeads.length > 1 && (
                <>
                  <p className="text-[11px] text-red-400 mt-1">Now click the lead to replace</p>
                  <div className="flex gap-1.5 mt-1">
                    {theirLeads.map((opp, si) => (
                      <button key={opp.pokemon.name} onClick={() => doSwitchTheir(si, opp.pokemon.name, pendingTheirIn)}
                        className="flex items-center gap-1 px-2 py-1 rounded border border-red-400 bg-red-950/30 text-red-200 text-[11px] hover:bg-red-900/40">
                        <img src={pokeSprite(opp.pokemon)} className="w-4 h-4 object-contain" alt="" />
                        <span className="capitalize">{opp.pokemon.name.split('-')[0]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Move table ───────────────────────────────────────────────── */}
      {moves.length === 0 ? (
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 text-center">
          <p className="text-gray-400 text-sm">No moves configured for this Pokémon.</p>
          <p className="text-gray-600 text-xs mt-1">Add moves in Team Builder to get suggestions.</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          {/* Table header */}
          <div className="px-3 py-2 border-b border-gray-700 grid gap-2 items-center bg-gray-900/40"
            style={{ gridTemplateColumns: moveCols }}>
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Move</span>
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Type</span>
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">Cat</span>
            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide">BP</span>
            {theirLeads.map((opp, i) => (
              <span key={i} className="text-[11px] text-gray-500 font-semibold uppercase tracking-wide text-right capitalize truncate">
                {opp.pokemon.name.replace(/-/g, ' ')}
              </span>
            ))}
          </div>

          {/* Move rows */}
          {moves.map((sug, idx) => {
            const rollsOpen = expandedRolls.has(sug.slug);
            const isBest = idx === 0 && !sug.weatherNullified && sug.bestEffectiveness > 0;
            return (
              <div key={sug.slug}
                className={`border-b border-gray-700/40 last:border-0 transition-colors ${
                  isBest ? 'bg-yellow-950/20' : sug.weatherNullified || sug.bestEffectiveness === 0 ? 'opacity-40' : ''
                }`}>
                <div className="px-3 py-2.5 grid gap-2 items-center"
                  style={{ gridTemplateColumns: moveCols }}>

                  {/* Move name */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isBest && <span className="text-yellow-400 text-xs shrink-0">★</span>}
                    <span className="text-white text-sm font-medium truncate">{sug.displayName}</span>
                    {sug.move.basePower > 0 && !sug.weatherNullified && (
                      <button
                        onClick={() => setExpandedRolls(prev => { const s = new Set(prev); rollsOpen ? s.delete(sug.slug) : s.add(sug.slug); return s; })}
                        className="text-[10px] text-gray-600 hover:text-gray-400 shrink-0 transition-colors ml-1">
                        {rollsOpen ? '▲' : '▼'}
                      </button>
                    )}
                  </div>

                  <TypeBadge type={sug.move.type} size="sm" />

                  <span className={`text-[11px] font-medium ${
                    sug.move.category === 'physical' ? 'text-orange-400' :
                    sug.move.category === 'special'  ? 'text-blue-400'   : 'text-gray-500'
                  }`}>
                    {sug.move.category === 'physical' ? 'Phys' : sug.move.category === 'special' ? 'Spec' : 'Stat'}
                  </span>

                  <span className="text-[11px] text-gray-500">{sug.move.basePower > 0 ? sug.move.basePower : '—'}</span>

                  {/* Per-defender results */}
                  {sug.results.map((res, ri) => {
                    const showDmg = !sug.weatherNullified && res.effectiveness > 0 && sug.move.basePower > 0;
                    return (
                      <div key={ri} className="text-right">
                        {!showDmg ? (
                          <span className="text-[11px] text-gray-600">
                            {sug.weatherNullified ? 'Nullified' : res.effectiveness === 0 ? 'Immune' : '—'}
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-white font-mono text-xs font-bold">{res.minPct}–{res.maxPct}%</div>
                            <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${res.maxPct >= 100 ? 'bg-red-500' : res.maxPct >= 50 ? 'bg-orange-400' : 'bg-blue-400'}`}
                                style={{ width: `${Math.min(res.maxPct, 100)}%` }} />
                            </div>
                            {res.koPct === 100  && <span className="text-[10px] text-red-400 font-bold">Guaranteed KO</span>}
                            {res.koPct > 0 && res.koPct < 100 && <span className="text-[10px] text-orange-400 font-semibold">{res.koPct}% KO</span>}
                            {res.koPct === 0 && res.maxPct >= 50 && <span className="text-[10px] text-gray-600">2HKO?</span>}
                            {res.stab && <span className="text-[10px] text-yellow-600 ml-1">STAB</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Rolls row (expandable) */}
                {rollsOpen && (
                  <div className="px-3 pb-3 border-t border-gray-700/30 pt-2">
                    {sug.results.map((res, ri) => {
                      if (!res.rolls.length) return null;
                      const defHP = res.maxPct > 0 ? Math.round(res.rolls[15] / (res.maxPct / 100)) : 0;
                      const koCount = res.rolls.filter(r => defHP > 0 && r >= defHP).length;
                      return (
                        <div key={ri} className="mb-1.5 last:mb-0">
                          <span className="text-[10px] text-gray-500 mr-2 capitalize">
                            {res.defender.pokemon.name.replace(/-/g, ' ')} ({koCount}/16 KO):
                          </span>
                          <span className="inline-flex gap-0.5 flex-wrap">
                            {res.rolls.map((r, i2) => {
                              const ko = defHP > 0 && r >= defHP;
                              return (
                                <span key={i2} className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                                  ko ? 'bg-red-900/60 text-red-300 font-bold' : 'bg-gray-700/60 text-gray-400'
                                }`}>{r}</span>
                              );
                            })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-gray-600 text-xs">
        Damage uses inferred builds for opponents. Actual results vary with items, abilities, and spreads.
        Flying-types are treated as ungrounded (terrain boosts excluded).
      </p>
    </div>
  );
}
