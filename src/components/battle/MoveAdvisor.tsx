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

// ── Stat stages ───────────────────────────────────────────────────────────
interface PokemonStages { atk: number; def: number; spa: number; spd: number; spe: number }
const defaultStages = (): PokemonStages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0 });
const STAGE_STATS: { key: keyof PokemonStages; label: string }[] = [
  { key: 'atk', label: 'Atk' }, { key: 'def', label: 'Def' },
  { key: 'spa', label: 'SpA' }, { key: 'spd', label: 'SpD' },
  { key: 'spe', label: 'Spe' },
];

// ── Item display ──────────────────────────────────────────────────────────
const ITEM_OPTIONS: { value: AttackerItem; label: string }[] = [
  { value: 'none',         label: 'No Item' },
  { value: 'life-orb',     label: 'Life Orb ×1.3' },
  { value: 'choice-band',  label: 'Choice Band ×1.5 Phys' },
  { value: 'choice-specs', label: 'Choice Specs ×1.5 Spec' },
  { value: 'muscle-band',  label: 'Muscle Band ×1.1 Phys' },
  { value: 'wise-glasses', label: 'Wise Glasses ×1.1 Spec' },
  { value: 'expert-belt',  label: 'Expert Belt ×1.2 SE' },
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

const TERRAIN_OPTIONS: { id: Terrain; label: string; activeClass: string }[] = [
  { id: 'none',     label: 'None',     activeClass: 'bg-gray-600 border-gray-500 text-white' },
  { id: 'electric', label: 'Electric', activeClass: 'bg-yellow-500 border-yellow-400 text-black' },
  { id: 'grassy',   label: 'Grassy',   activeClass: 'bg-green-600 border-green-500 text-white' },
  { id: 'psychic',  label: 'Psychic',  activeClass: 'bg-pink-600 border-pink-500 text-white' },
  { id: 'misty',    label: 'Misty',    activeClass: 'bg-purple-500 border-purple-400 text-white' },
];

function weatherMoveBadge(weather: Weather, moveType: string): { text: string; cls: string } | null {
  const mod = weatherMoveMod(weather, moveType);
  if (mod === 1) return null;
  const lbl: Partial<Record<Weather, string>> = { sun: 'Sun', rain: 'Rain', extremesun: 'Extreme Sun', heavyrain: 'Heavy Rain' };
  const l = lbl[weather] ?? '';
  if (mod === 0) return { text: `${l} — Nullified`, cls: 'text-red-400 bg-red-900/40 border border-red-700/50' };
  if (mod > 1)   return { text: `${l} +50%`,        cls: 'text-emerald-300 bg-emerald-900/40 border border-emerald-700/50' };
  return           { text: `${l} −50%`,             cls: 'text-gray-400 bg-gray-900/40 border border-gray-700/50' };
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
      <button onClick={onDec} disabled={stage <= -6}
        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-white leading-none flex items-center justify-center text-sm transition-colors">−</button>
      <button onClick={onReset} title={stage !== 0 ? 'Reset to 0' : undefined}
        className={`w-6 text-center text-xs font-mono font-bold transition-colors ${numCls} ${stage !== 0 ? 'hover:text-white cursor-pointer' : 'cursor-default'}`}>
        {stage > 0 ? `+${stage}` : stage}
      </button>
      <button onClick={onInc} disabled={stage >= 6}
        className="w-5 h-5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-25 text-white leading-none flex items-center justify-center text-sm transition-colors">+</button>
    </div>
  );
}

// ── Toggle button helper ──────────────────────────────────────────────────
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        active ? 'bg-purple-700 border-purple-500 text-white' : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
      }`}>
      {children}
    </button>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export function MoveAdvisor({ ourLeads, theirLeads, ourBench, theirBench, onSwitchOurLead, onSwitchTheirLead, onBack, onReset }: Props) {
  const isDoubles = ourLeads.length > 1;

  const [fetchedMoves, setFetchedMoves] = useState<Map<string, FetchedMove[]>>(new Map());
  const [loading, setLoading]           = useState(true);
  const [activeId, setActiveId]         = useState<string>('');

  // Field conditions
  const [weather,     setWeather]     = useState<Weather>('none');
  const [terrain,     setTerrain]     = useState<Terrain>('none');
  const [reflect,     setReflect]     = useState(false);
  const [lightScreen, setLightScreen] = useState(false);
  const [auroraVeil,  setAuroraVeil]  = useState(false);
  const [isCrit,      setIsCrit]      = useState(false);
  const [isSpread,    setIsSpread]    = useState(false);

  // Per-lead attacker options
  const [ourStages,     setOurStages]     = useState<Map<string, PokemonStages>>(new Map());
  const [theirStages,   setTheirStages]   = useState<Map<number, PokemonStages>>(new Map());
  const [burnedLeads,   setBurnedLeads]   = useState<Set<string>>(new Set());
  const [helpingHand,   setHelpingHand]   = useState<Set<string>>(new Set());
  const [ourItems,      setOurItems]      = useState<Map<string, AttackerItem>>(new Map());

  // Switch mechanism
  const [pendingOurIn,   setPendingOurIn]   = useState<string | null>(null);
  const [pendingTheirIn, setPendingTheirIn] = useState<string | null>(null);

  // Rolls display (expandable per move)
  const [expandedRolls, setExpandedRolls] = useState<Set<string>>(new Set());

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

  // ── Stage helpers ────────────────────────────────────────────────────────
  const getOurS   = (id: string) => ourStages.get(id)  ?? defaultStages();
  const getTheirS = (i: number)  => theirStages.get(i) ?? defaultStages();

  function adjustOurS(id: string, stat: keyof PokemonStages, delta: number) {
    setOurStages(prev => { const m = new Map(prev); const cur = m.get(id) ?? defaultStages(); m.set(id, { ...cur, [stat]: Math.max(-6, Math.min(6, cur[stat] + delta)) }); return m; });
  }
  function resetOurS(id: string, stat: keyof PokemonStages) {
    setOurStages(prev => { const m = new Map(prev); const cur = m.get(id) ?? defaultStages(); m.set(id, { ...cur, [stat]: 0 }); return m; });
  }
  function adjustTheirS(i: number, stat: keyof PokemonStages, delta: number) {
    setTheirStages(prev => { const m = new Map(prev); const cur = m.get(i) ?? defaultStages(); m.set(i, { ...cur, [stat]: Math.max(-6, Math.min(6, cur[stat] + delta)) }); return m; });
  }
  function resetTheirS(i: number, stat: keyof PokemonStages) {
    setTheirStages(prev => { const m = new Map(prev); const cur = m.get(i) ?? defaultStages(); m.set(i, { ...cur, [stat]: 0 }); return m; });
  }

  // ── Switch helpers ───────────────────────────────────────────────────────
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

  // ── Damage calculation (reactive to all field/stage/option changes) ──────
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
        const terrainNull      = terrainMoveMod(terrain, fm.move.type, fm.move.name, attacker.pokemon.types, []) === 0;

        const results: PerDefender[] = theirLeads.map((opp, di) => {
          const defS = theirStages.get(di) ?? defaultStages();
          const res  = calcDamage(
            attackerSnap, fm.move, opp.snapshot, weather, atkS, defS,
            {
              terrain, isCrit, isSpread,
              isHelpingHand: helpingHand.has(attacker.id),
              isBurned: burnedLeads.has(attacker.id),
              reflect, lightScreen, auroraVeil,
              attackerItem: ourItems.get(attacker.id) ?? 'none',
              isDoubles,
            },
          );
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

  // ── Render ───────────────────────────────────────────────────────────────
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
          <p className="text-gray-400 text-sm mt-1">Adjust field conditions and stat stages — damage updates instantly.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={onBack}  className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">← Leads</button>
          <button onClick={onReset} className="px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm transition-colors">New Battle</button>
        </div>
      </div>

      {/* ── Field Conditions ─────────────────────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700 space-y-4">
        <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Field Conditions</p>

        {/* Weather */}
        <div>
          <p className="text-xs text-gray-500 font-medium mb-2">Weather</p>
          <div className="flex gap-2 flex-wrap">
            {WEATHER_OPTIONS.map(w => (
              <button key={w.id} onClick={() => setWeather(w.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  weather === w.id ? w.activeClass : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>{w.label}</button>
            ))}
          </div>
          {weather !== 'none' && (
            <div className="mt-2 text-xs space-y-0.5">
              {weather === 'sun'        && <><p className="text-yellow-400">Fire ×1.5</p><p className="text-blue-400/70">Water ×0.5</p></>}
              {weather === 'extremesun' && <><p className="text-orange-400">Fire ×1.5</p><p className="text-red-400">Water — Nullified</p></>}
              {weather === 'rain'       && <><p className="text-blue-400">Water ×1.5</p><p className="text-orange-400/70">Fire ×0.5</p></>}
              {weather === 'heavyrain'  && <><p className="text-blue-300">Water ×1.5</p><p className="text-red-400">Fire — Nullified</p></>}
              {weather === 'sand'       && <p className="text-amber-400">Rock: SpD ×1.5 vs special moves</p>}
              {weather === 'snow'       && <p className="text-cyan-400">Ice: Def ×1.5 vs physical moves</p>}
            </div>
          )}
        </div>

        {/* Terrain */}
        <div>
          <p className="text-xs text-gray-500 font-medium mb-2">Terrain</p>
          <div className="flex gap-2 flex-wrap">
            {TERRAIN_OPTIONS.map(t => (
              <button key={t.id} onClick={() => setTerrain(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  terrain === t.id ? t.activeClass : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600'
                }`}>{t.label}</button>
            ))}
          </div>
          {terrain !== 'none' && (
            <div className="mt-2 text-xs">
              {terrain === 'electric' && <p className="text-yellow-400">Electric ×1.3 (grounded attacker)</p>}
              {terrain === 'grassy'   && <p className="text-green-400">Grass ×1.3 (grounded) · Earthquake/Bulldoze ×0.5</p>}
              {terrain === 'psychic'  && <p className="text-pink-400">Psychic ×1.3 (grounded attacker)</p>}
              {terrain === 'misty'    && <p className="text-purple-400">Dragon ×0.5 vs grounded · blocks status</p>}
            </div>
          )}
        </div>

        {/* Screens & Battle Toggles */}
        <div>
          <p className="text-xs text-gray-500 font-medium mb-2">Screens & Modifiers</p>
          <div className="flex gap-2 flex-wrap">
            <Toggle active={reflect}     onClick={() => setReflect(v => !v)}>Reflect</Toggle>
            <Toggle active={lightScreen} onClick={() => setLightScreen(v => !v)}>Light Screen</Toggle>
            <Toggle active={auroraVeil}  onClick={() => setAuroraVeil(v => !v)}>Aurora Veil</Toggle>
            <Toggle active={isCrit}      onClick={() => setIsCrit(v => !v)}>Critical Hit ×1.5</Toggle>
            {isDoubles && (
              <Toggle active={isSpread} onClick={() => setIsSpread(v => !v)}>Spread −25%</Toggle>
            )}
          </div>
          {(reflect || lightScreen || auroraVeil) && (
            <p className="text-xs text-gray-500 mt-1.5">Screens halve damage · bypassed by crits</p>
          )}
          {isCrit && (
            <p className="text-xs text-orange-400 mt-1.5">Crit: ×1.5 · ignores defensive boosts & screens</p>
          )}
        </div>
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
                  {pendingOurIn && <span className="text-blue-400 text-[10px] mt-0.5 font-semibold">← replace</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1.5">Bench</p>
            <div className="flex gap-2 flex-wrap">
              {ourBench.length === 0
                ? <span className="text-xs text-gray-600 italic">No bench</span>
                : ourBench.map(m => (
                  <button key={m.id}
                    onClick={() => {
                      if (ourLeads.length === 1) { doSwitchOur(0, ourLeads[0].id, m.id); }
                      else { setPendingOurIn(prev => prev === m.id ? null : m.id); setPendingTheirIn(null); }
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
                ))
              }
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
                  {pendingTheirIn && <span className="text-red-400 text-[10px] mt-0.5 font-semibold">← replace</span>}
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 font-medium mb-1.5">Bench</p>
            <div className="flex gap-2 flex-wrap">
              {theirBench.length === 0
                ? <span className="text-xs text-gray-600 italic">No bench</span>
                : theirBench.map(opp => (
                  <button key={opp.pokemon.name}
                    onClick={() => {
                      if (theirLeads.length === 1) { doSwitchTheir(0, theirLeads[0].pokemon.name, opp.pokemon.name); }
                      else { setPendingTheirIn(prev => prev === opp.pokemon.name ? null : opp.pokemon.name); setPendingOurIn(null); }
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
                ))
              }
            </div>
            {pendingTheirIn && theirLeads.length > 1 && (
              <p className="text-xs text-red-400 mt-2">Click an active Pokémon above to swap it out</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Stat Stages + Attacker Options ───────────────────────────── */}
      <div className="bg-gray-800/60 rounded-2xl p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Stat Stages & Options</p>
          <button
            onClick={() => { setOurStages(new Map()); setTheirStages(new Map()); setBurnedLeads(new Set()); setHelpingHand(new Set()); setOurItems(new Map()); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors">Reset all</button>
        </div>
        <p className="text-xs text-gray-600 mb-4">Click a stage number to reset it to 0.</p>

        <div className="grid md:grid-cols-2 gap-5">

          {/* Our leads */}
          <div>
            <p className="text-xs text-blue-300 font-semibold mb-3">Your Leads</p>
            <div className="space-y-5">
              {ourLeads.map(lead => {
                const s = getOurS(lead.id);
                const isBurned = burnedLeads.has(lead.id);
                const hasHH    = helpingHand.has(lead.id);
                const item     = ourItems.get(lead.id) ?? 'none';
                return (
                  <div key={lead.id} className="flex items-start gap-2">
                    <img src={pokeSprite(lead.pokemon)} className="w-9 h-9 object-contain mt-0.5 shrink-0" alt="" />
                    <div className="min-w-0 flex-1">
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
                      {/* Attacker options */}
                      <div className="mt-2 space-y-1.5 pt-2 border-t border-gray-700/50">
                        <div className="flex gap-2 flex-wrap">
                          <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-400 hover:text-white transition-colors">
                            <input type="checkbox" checked={isBurned} onChange={() => setBurnedLeads(prev => { const s = new Set(prev); isBurned ? s.delete(lead.id) : s.add(lead.id); return s; })}
                              className="accent-red-500 w-3 h-3" />
                            Burned
                          </label>
                          {isDoubles && (
                            <label className="flex items-center gap-1 cursor-pointer text-xs text-gray-400 hover:text-white transition-colors">
                              <input type="checkbox" checked={hasHH} onChange={() => setHelpingHand(prev => { const s = new Set(prev); hasHH ? s.delete(lead.id) : s.add(lead.id); return s; })}
                                className="accent-purple-500 w-3 h-3" />
                              Helping Hand
                            </label>
                          )}
                        </div>
                        <select
                          value={item}
                          onChange={e => setOurItems(prev => { const m = new Map(prev); m.set(lead.id, e.target.value as AttackerItem); return m; })}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-red-500"
                        >
                          {ITEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Their leads */}
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
              {/* Active option badges */}
              {burnedLeads.has(lead.id)  && <span className="text-[10px] text-red-400 bg-red-900/40 px-1 rounded">Brn</span>}
              {helpingHand.has(lead.id)  && <span className="text-[10px] text-purple-400 bg-purple-900/40 px-1 rounded">HH</span>}
              {(ourItems.get(lead.id) ?? 'none') !== 'none' && <span className="text-[10px] text-yellow-400 bg-yellow-900/40 px-1 rounded">Item</span>}
            </button>
          ))}
        </div>
      )}

      {/* Attacker info bar */}
      {attacker && (
        <div className="flex items-center gap-3 bg-gray-800/60 rounded-xl p-3 border border-gray-700 flex-wrap">
          <img src={pokeSprite(attacker.pokemon)} className="w-12 h-12 object-contain" alt="" />
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold capitalize">
              {attacker.nickname || attacker.pokemon.name.replace(/-/g, ' ')}
            </div>
            <div className="flex gap-1 mt-0.5 flex-wrap">
              {attacker.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {attacker.nature} · {attacker.evs.atk > attacker.evs.spa ? `Atk ${attacker.evs.atk}` : `SpA ${attacker.evs.spa}`} EVs
            </div>
            {/* Active modifier badges */}
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {Object.entries(getOurS(attacker.id)).filter(([, v]) => v !== 0).map(([k, v]) => (
                <span key={k} className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-gray-700 ${(v as number) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {k.charAt(0).toUpperCase() + k.slice(1)} {(v as number) > 0 ? '+' : ''}{v}
                </span>
              ))}
              {burnedLeads.has(attacker.id)  && <span className="text-xs text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">Burned</span>}
              {helpingHand.has(attacker.id)  && <span className="text-xs text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">Helping Hand ×1.5</span>}
              {isCrit                         && <span className="text-xs text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded">Crit ×1.5</span>}
              {isSpread && isDoubles          && <span className="text-xs text-yellow-400/80 bg-yellow-900/30 px-1.5 py-0.5 rounded">Spread ×0.75</span>}
              {(ourItems.get(attacker.id) ?? 'none') !== 'none' && (
                <span className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">
                  {ITEM_OPTIONS.find(o => o.value === ourItems.get(attacker.id))?.label}
                </span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-600 px-2">vs.</div>
          <div className="flex gap-3 flex-wrap">
            {theirLeads.map((opp, i) => {
              const s = getTheirS(i);
              const activeStages = Object.entries(s).filter(([, v]) => v !== 0);
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <img src={pokeSprite(opp.pokemon)} className="w-10 h-10 object-contain" alt="" />
                  <span className="text-xs text-gray-400 capitalize">{opp.pokemon.name.replace(/-/g, ' ')}</span>
                  <span className="text-xs text-gray-600">{opp.nature}</span>
                  {activeStages.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-center">
                      {activeStages.map(([k, v]) => (
                        <span key={k} className={`text-xs font-mono font-bold px-1 rounded bg-gray-700 ${(v as number) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                          {k.charAt(0).toUpperCase()}{(v as number) > 0 ? '+' : ''}{v}
                        </span>
                      ))}
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
            const wBadge    = weatherMoveBadge(weather, sug.move.type);
            const rollsOpen = expandedRolls.has(sug.slug);
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
                    <span className="text-xs bg-yellow-900/60 text-yellow-400 border border-yellow-700/50 px-2 py-0.5 rounded-full font-bold">Best Pick</span>
                  )}
                  {sug.bestKoPct === 100 && (
                    <span className="text-xs bg-red-900/60 text-red-300 border border-red-700/50 px-2 py-0.5 rounded-full font-bold">Guaranteed OHKO</span>
                  )}
                  {sug.bestKoPct > 0 && sug.bestKoPct < 100 && (
                    <span className="text-xs bg-orange-900/40 text-orange-300 border border-orange-700/40 px-2 py-0.5 rounded-full font-semibold">{sug.bestKoPct}% OHKO</span>
                  )}
                  {sug.move.basePower > 0 && !sug.weatherNullified && (
                    <button
                      onClick={() => setExpandedRolls(prev => {
                        const s = new Set(prev);
                        rollsOpen ? s.delete(sug.slug) : s.add(sug.slug);
                        return s;
                      })}
                      className="ml-auto text-xs text-gray-600 hover:text-gray-400 border border-gray-700 hover:border-gray-600 px-2 py-0.5 rounded-lg transition-colors"
                    >{rollsOpen ? 'Hide rolls' : 'Show rolls'}</button>
                  )}
                </div>

                {/* Per-defender results */}
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${theirLeads.length}, 1fr)` }}>
                  {sug.results.map((res, ri) => {
                    const label    = effLabel(res.effectiveness);
                    const defNote  = weatherDefNote(weather, res.defender.pokemon.types, sug.move.category);
                    const defS     = getTheirS(ri);
                    const showDmg  = !sug.weatherNullified && res.effectiveness > 0 && sug.move.basePower > 0;
                    const relStage = sug.move.category === 'physical' ? defS.def : sug.move.category === 'special' ? defS.spd : 0;
                    const defHP    = res.rolls.length > 0 ? Math.round(res.rolls[15] / (res.maxPct / 100)) : 0;

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
                              {res.koPct === 100 && <span className="text-xs text-red-300 font-bold">Guaranteed OHKO</span>}
                              {res.koPct > 0 && res.koPct < 100 && <span className="text-xs text-orange-300 font-bold">{res.koPct}% OHKO</span>}
                              {res.koPct === 0 && res.maxPct >= 50 && <span className="text-xs text-yellow-600">2HKO likely</span>}
                              {res.stab && <span className="text-xs text-yellow-500/80">STAB</span>}
                              {defNote && <span className="text-xs text-amber-400/70">{defNote}</span>}
                              {relStage !== 0 && (
                                <span className={`text-xs font-mono font-bold ${relStage > 0 ? 'text-orange-400/80' : 'text-green-400/80'}`}>
                                  {sug.move.category === 'physical' ? 'Def' : 'SpD'}{relStage > 0 ? '+' : ''}{relStage}
                                </span>
                              )}
                            </div>

                            {/* Damage rolls (expandable) */}
                            {rollsOpen && res.rolls.length === 16 && (
                              <div className="mt-2 pt-2 border-t border-gray-700/40">
                                <p className="text-[10px] text-gray-600 mb-1">Rolls ({res.rolls.filter(r => defHP > 0 && r >= defHP).length}/16 KO)</p>
                                <div className="flex gap-0.5 flex-wrap">
                                  {res.rolls.map((r, ri2) => {
                                    const ko = defHP > 0 && r >= defHP;
                                    return (
                                      <span key={ri2}
                                        className={`text-[10px] font-mono px-1 py-0.5 rounded ${ko ? 'bg-red-900/60 text-red-300 font-bold' : 'bg-gray-700/60 text-gray-400'}`}
                                      >{r}</span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
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
          <span className="text-gray-400 font-semibold">Note:</span> Damage uses inferred competitive builds for opponents.
          Real results may differ based on actual spreads, held items, abilities, and multi-hit modifiers.
          Terrain boosts assume grounded Pokémon (Flying-types excluded). Ability interactions not modelled.
        </p>
      </div>
    </div>
  );
}
