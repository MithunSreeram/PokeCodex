import { useState, useEffect, useMemo } from 'react';
import type { TeamMember } from '../../store/teamStore';
import type { InferredOpponent } from '../../utils/opponentInference';
import { makeSnapshot, calcDamage, weatherMoveMod } from '../../utils/damageCalc';
import type { MoveData, Weather, Terrain, AttackerItem } from '../../utils/damageCalc';
import { fetchMoveData } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { Spinner } from '../ui/Spinner';
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

const WEATHER_OPTIONS: { id: Weather; label: string; color: string }[] = [
  { id: 'none',       label: 'None',     color: 'var(--text-3)' },
  { id: 'sun',        label: 'Sun',      color: '#FFCB2D' },
  { id: 'rain',       label: 'Rain',     color: '#4D9DE0' },
  { id: 'sand',       label: 'Sand',     color: '#DBA760' },
  { id: 'snow',       label: 'Snow',     color: '#8FDAE5' },
  { id: 'extremesun', label: 'Ext.Sun',  color: '#FF6B35' },
  { id: 'heavyrain',  label: 'H.Rain',   color: '#7060F5' },
];

const TERRAIN_OPTIONS: { id: Terrain; label: string; color: string }[] = [
  { id: 'none',     label: 'None',   color: 'var(--text-3)' },
  { id: 'electric', label: 'Elec',  color: '#FFCB2D' },
  { id: 'grassy',   label: 'Grass', color: '#5FCC4F' },
  { id: 'psychic',  label: 'Psych', color: '#FF5C9C' },
  { id: 'misty',    label: 'Misty', color: '#B557D6' },
];

function pokeSprite(poke: { sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } } }): string {
  return poke.sprites.other?.['official-artwork']?.front_default ?? poke.sprites.front_default ?? '';
}

function StageRow({ label, stage, onDec, onInc, onReset }: {
  label: string; stage: number; onDec: () => void; onInc: () => void; onReset: () => void;
}) {
  const col = stage > 0 ? 'var(--green)' : stage < 0 ? 'var(--accent)' : 'var(--text-3)';
  const btn: React.CSSProperties = { appearance: 'none', border: '1px solid var(--line-hard)', background: 'var(--bg-2)', color: 'var(--text-1)', width: 16, height: 16, fontSize: 11, lineHeight: 1, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <span className="hud-label" style={{ width: 26, fontSize: 9, flexShrink: 0 }}>{label}</span>
      <button style={{ ...btn, opacity: stage <= -6 ? 0.2 : 1 }} onClick={onDec} disabled={stage <= -6}>−</button>
      <button onClick={onReset} style={{ width: 24, textAlign: 'center', background: 'transparent', border: 0, padding: 0, cursor: stage !== 0 ? 'pointer' : 'default' }}>
        <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: col }}>
          {stage > 0 ? `+${stage}` : stage}
        </span>
      </button>
      <button style={{ ...btn, opacity: stage >= 6 ? 0.2 : 1 }} onClick={onInc} disabled={stage >= 6}>+</button>
    </div>
  );
}

function FieldPill({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      appearance: 'none', cursor: 'pointer',
      padding: '2px 8px', fontFamily: 'Chakra Petch', fontWeight: 600, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
      border: `1px solid ${on ? (color ?? 'var(--accent)') : 'var(--line-hard)'}`,
      background: on ? (color ? color + '22' : 'var(--accent-soft)') : 'var(--bg-2)',
      color: on ? (color ?? 'var(--accent)') : 'var(--text-3)',
      transition: 'all .1s',
    }}>
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

  function doSwitchOur(_slotIdx: number, outId: string, inId: string) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedMoves, weather, terrain, isCrit, isSpread, reflect, lightScreen, auroraVeil,
      ourLeads, theirLeads, ourStages, theirStages, burnedLeads, helpingHand, ourItems, isDoubles]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 16 }}>
        <Spinner size={7} />
        <span className="hud-label">FETCHING MOVE DATA…</span>
      </div>
    );
  }

  const attacker = ourLeads.find(a => a.id === activeId);
  const moves    = suggestions.get(activeId) ?? [];
  const moveCols = `minmax(120px,1fr) 50px 42px 28px ${theirLeads.map(() => 'minmax(100px,1fr)').join(' ')}`;

  const ipt: React.CSSProperties = { appearance: 'none', border: '1px solid var(--line-hard)', background: 'var(--bg-0)', color: 'var(--text-0)', padding: '4px 8px', fontFamily: 'Chakra Petch', fontSize: 10, width: '100%', outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 className="hud-title" style={{ margin: 0, fontSize: 18 }}>
          <span style={{ color: 'var(--accent)' }}>MOVE</span> ADVISOR
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack}  className="btn btn-sm">← LEADS</button>
          <button onClick={onReset} className="btn btn-sm">NEW BATTLE</button>
        </div>
      </div>

      {/* ── Field Conditions ────────────────────────────────────────────── */}
      <div className="panel">
        <div className="panel-head"><span className="dot" /><h3>Field Conditions</h3></div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Weather */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="hud-label" style={{ width: 56, flexShrink: 0 }}>Weather</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {WEATHER_OPTIONS.map(w => (
                <FieldPill key={w.id} on={weather === w.id} color={w.id !== 'none' ? w.color : undefined} onClick={() => setWeather(w.id)}>
                  {w.label}
                </FieldPill>
              ))}
            </div>
          </div>

          {/* Terrain */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="hud-label" style={{ width: 56, flexShrink: 0 }}>Terrain</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {TERRAIN_OPTIONS.map(t => (
                <FieldPill key={t.id} on={terrain === t.id} color={t.id !== 'none' ? t.color : undefined} onClick={() => setTerrain(t.id)}>
                  {t.label}
                </FieldPill>
              ))}
            </div>
          </div>

          {/* Mods */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="hud-label" style={{ width: 56, flexShrink: 0 }}>Mods</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <FieldPill on={reflect}     onClick={() => setReflect(v => !v)}>Reflect</FieldPill>
              <FieldPill on={lightScreen} onClick={() => setLightScreen(v => !v)}>Light Scr</FieldPill>
              <FieldPill on={auroraVeil}  onClick={() => setAuroraVeil(v => !v)}>Aurora Veil</FieldPill>
              <FieldPill on={isCrit}      color="var(--amber)" onClick={() => setIsCrit(v => !v)}>Crit ×1.5</FieldPill>
              {isDoubles && <FieldPill on={isSpread} color="var(--cyan)" onClick={() => setIsSpread(v => !v)}>Spread ×0.75</FieldPill>}
            </div>
          </div>

          {/* Active notes */}
          {(weather !== 'none' || terrain !== 'none' || reflect || lightScreen || auroraVeil || isCrit) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--line)' }}>
              {weather === 'sun'        && <><span className="mono" style={{ fontSize: 9, color: '#FFCB2D' }}>Fire ×1.5</span><span className="mono" style={{ fontSize: 9, color: '#4D9DE0' }}>Water ×0.5</span></>}
              {weather === 'extremesun' && <><span className="mono" style={{ fontSize: 9, color: '#FF6B35' }}>Fire ×1.5</span><span className="mono" style={{ fontSize: 9, color: 'var(--accent)' }}>Water nullified</span></>}
              {weather === 'rain'       && <><span className="mono" style={{ fontSize: 9, color: '#4D9DE0' }}>Water ×1.5</span><span className="mono" style={{ fontSize: 9, color: '#FF6B35' }}>Fire ×0.5</span></>}
              {weather === 'heavyrain'  && <><span className="mono" style={{ fontSize: 9, color: '#4D9DE0' }}>Water ×1.5</span><span className="mono" style={{ fontSize: 9, color: 'var(--accent)' }}>Fire nullified</span></>}
              {weather === 'sand'       && <span className="mono" style={{ fontSize: 9, color: '#DBA760' }}>Rock SpD ×1.5</span>}
              {weather === 'snow'       && <span className="mono" style={{ fontSize: 9, color: '#8FDAE5' }}>Ice Def ×1.5</span>}
              {terrain === 'electric'   && <span className="mono" style={{ fontSize: 9, color: '#FFCB2D' }}>Electric ×1.3</span>}
              {terrain === 'grassy'     && <span className="mono" style={{ fontSize: 9, color: '#5FCC4F' }}>Grass ×1.3 · EQ ×0.5</span>}
              {terrain === 'psychic'    && <span className="mono" style={{ fontSize: 9, color: '#FF5C9C' }}>Psychic ×1.3</span>}
              {terrain === 'misty'      && <span className="mono" style={{ fontSize: 9, color: '#B557D6' }}>Dragon ×0.5</span>}
              {(reflect || auroraVeil)  && <span className="mono" style={{ fontSize: 9, color: 'var(--cyan)' }}>Reflect active</span>}
              {(lightScreen || auroraVeil) && <span className="mono" style={{ fontSize: 9, color: 'var(--cyan)' }}>Light Screen active</span>}
              {isCrit                   && <span className="mono" style={{ fontSize: 9, color: 'var(--amber)' }}>Crit: ignores def boosts &amp; screens</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── Battlers ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>

        {/* Our side */}
        <div className="panel">
          <div className="panel-head">
            <span className="dot" style={{ background: 'var(--cyan)' }} />
            <h3 style={{ color: 'var(--cyan)' }}>YOUR LEAD</h3>
            {ourLeads.length > 1 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                {ourLeads.map(lead => (
                  <button key={lead.id} onClick={() => setActiveId(lead.id)} style={{
                    appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                    padding: '2px 6px',
                    border: `1px solid ${activeId === lead.id ? 'var(--cyan)' : 'var(--line-hard)'}`,
                    background: activeId === lead.id ? 'rgba(43,217,255,.1)' : 'var(--bg-2)',
                    fontFamily: 'Chakra Petch', fontSize: 10, color: activeId === lead.id ? 'var(--cyan)' : 'var(--text-2)',
                    textTransform: 'capitalize',
                  }}>
                    <img src={pokeSprite(lead.pokemon)} style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" />
                    {(lead.nickname || lead.pokemon.name).split('-')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {attacker && (
              <>
                {/* Identity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <img src={pokeSprite(attacker.pokemon)} style={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0 }} alt="" />
                  <div>
                    <div className="hud-title" style={{ fontSize: 13, textTransform: 'capitalize' }}>
                      {attacker.nickname || attacker.pokemon.name.replace(/-/g, ' ')}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      {attacker.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                    </div>
                    <div className="hud-label" style={{ fontSize: 9, marginTop: 3 }}>{attacker.nature} nature</div>
                  </div>
                </div>

                {/* Stat stages */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 12px' }}>
                  {STAGE_STATS.map(({ key, label }) => (
                    <StageRow key={key} label={label} stage={getOurS(attacker.id)[key]}
                      onDec={() => adjustOurS(attacker.id, key, -1)}
                      onInc={() => adjustOurS(attacker.id, key,  1)}
                      onReset={() => resetOurS(attacker.id, key)} />
                  ))}
                </div>

                {/* Per-lead options */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                      <input type="checkbox" checked={burnedLeads.has(attacker.id)}
                        onChange={() => setBurnedLeads(prev => { const s = new Set(prev); burnedLeads.has(attacker.id) ? s.delete(attacker.id) : s.add(attacker.id); return s; })}
                        style={{ accentColor: 'var(--accent)', width: 11, height: 11 }} />
                      <span className="hud-label" style={{ fontSize: 9 }}>Burned</span>
                    </label>
                    {isDoubles && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                        <input type="checkbox" checked={helpingHand.has(attacker.id)}
                          onChange={() => setHelpingHand(prev => { const s = new Set(prev); helpingHand.has(attacker.id) ? s.delete(attacker.id) : s.add(attacker.id); return s; })}
                          style={{ accentColor: 'var(--cyan)', width: 11, height: 11 }} />
                        <span className="hud-label" style={{ fontSize: 9 }}>Helping Hand</span>
                      </label>
                    )}
                  </div>
                  <select value={ourItems.get(attacker.id) ?? 'none'}
                    onChange={e => setOurItems(prev => { const m = new Map(prev); m.set(attacker.id, e.target.value as AttackerItem); return m; })}
                    style={ipt}>
                    {ITEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </>
            )}

            {/* Our bench */}
            {ourBench.length > 0 && (
              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 8 }}>
                <div className="hud-label" style={{ fontSize: 9, marginBottom: 6 }}>BENCH · SWITCH IN</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {ourBench.map(m => (
                    <button key={m.id}
                      onClick={() => {
                        if (ourLeads.length === 1) doSwitchOur(0, ourLeads[0].id, m.id);
                        else { setPendingOurIn(prev => prev === m.id ? null : m.id); setPendingTheirIn(null); }
                      }}
                      style={{
                        appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                        border: `1px solid ${pendingOurIn === m.id ? 'var(--cyan)' : 'var(--line-hard)'}`,
                        background: pendingOurIn === m.id ? 'rgba(43,217,255,.1)' : 'var(--bg-2)',
                        fontFamily: 'Chakra Petch', fontSize: 10, color: pendingOurIn === m.id ? 'var(--cyan)' : 'var(--text-2)',
                        textTransform: 'capitalize', transition: 'all .1s',
                      }}>
                      <img src={pokeSprite(m.pokemon)} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="" />
                      {(m.nickname || m.pokemon.name).split('-')[0]}
                      <span style={{ color: 'var(--text-3)', fontSize: 10 }}>⇆</span>
                    </button>
                  ))}
                </div>
                {pendingOurIn && ourLeads.length > 1 && (
                  <>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--cyan)', marginTop: 6 }}>Select the lead to replace:</div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                      {ourLeads.map((lead, si) => (
                        <button key={lead.id} onClick={() => doSwitchOur(si, lead.id, pendingOurIn)}
                          style={{ appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--cyan)', background: 'rgba(43,217,255,.08)', fontFamily: 'Chakra Petch', fontSize: 10, color: 'var(--cyan)', textTransform: 'capitalize' }}>
                          <img src={pokeSprite(lead.pokemon)} style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" />
                          {(lead.nickname || lead.pokemon.name).split('-')[0]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Their side */}
        <div className="panel">
          <div className="panel-head">
            <span className="dot" />
            <h3 style={{ color: 'var(--accent)' }}>THEIR LEAD{theirLeads.length > 1 ? 'S' : ''}</h3>
          </div>
          <div style={{ padding: '10px 12px', display: 'grid', gap: 14, gridTemplateColumns: theirLeads.length > 1 ? '1fr 1fr' : '1fr' }}>
            {theirLeads.map((opp, i) => {
              const s = getTheirS(i);
              return (
                <div key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <img src={pokeSprite(opp.pokemon)} style={{ width: 48, height: 48, objectFit: 'contain', flexShrink: 0 }} alt="" />
                    <div>
                      <div className="hud-title" style={{ fontSize: 12, textTransform: 'capitalize' }}>
                        {opp.pokemon.name.replace(/-/g, ' ')}
                      </div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                        {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                      <div className="hud-label" style={{ fontSize: 9, marginTop: 3 }}>{opp.nature} · {opp.role}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 8px' }}>
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
            <div style={{ borderTop: '1px solid var(--line)', margin: '0 12px 12px', paddingTop: 8 }}>
              <div className="hud-label" style={{ fontSize: 9, marginBottom: 6 }}>BENCH · SWITCH IN</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {theirBench.map(opp => (
                  <button key={opp.pokemon.name}
                    onClick={() => {
                      if (theirLeads.length === 1) doSwitchTheir(0, theirLeads[0].pokemon.name, opp.pokemon.name);
                      else { setPendingTheirIn(prev => prev === opp.pokemon.name ? null : opp.pokemon.name); setPendingOurIn(null); }
                    }}
                    style={{
                      appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px',
                      border: `1px solid ${pendingTheirIn === opp.pokemon.name ? 'var(--accent)' : 'var(--line-hard)'}`,
                      background: pendingTheirIn === opp.pokemon.name ? 'var(--accent-soft)' : 'var(--bg-2)',
                      fontFamily: 'Chakra Petch', fontSize: 10, color: pendingTheirIn === opp.pokemon.name ? 'var(--accent)' : 'var(--text-2)',
                      textTransform: 'capitalize', transition: 'all .1s',
                    }}>
                    <img src={pokeSprite(opp.pokemon)} style={{ width: 18, height: 18, objectFit: 'contain' }} alt="" />
                    {opp.pokemon.name.split('-')[0]}
                    <span style={{ color: 'var(--text-3)', fontSize: 10 }}>⇆</span>
                  </button>
                ))}
              </div>
              {pendingTheirIn && theirLeads.length > 1 && (
                <>
                  <div className="mono" style={{ fontSize: 9, color: 'var(--accent)', marginTop: 6 }}>Select the lead to replace:</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
                    {theirLeads.map((opp, si) => (
                      <button key={opp.pokemon.name} onClick={() => doSwitchTheir(si, opp.pokemon.name, pendingTheirIn)}
                        style={{ appearance: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', border: '1px solid var(--accent)', background: 'var(--accent-soft)', fontFamily: 'Chakra Petch', fontSize: 10, color: 'var(--accent)', textTransform: 'capitalize' }}>
                        <img src={pokeSprite(opp.pokemon)} style={{ width: 16, height: 16, objectFit: 'contain' }} alt="" />
                        {opp.pokemon.name.split('-')[0]}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Move table ───────────────────────────────────────────────────── */}
      {moves.length === 0 ? (
        <div className="panel" style={{ padding: '40px 20px', textAlign: 'center' }}>
          <div className="hud-label" style={{ marginBottom: 6 }}>NO MOVES CONFIGURED</div>
          <p style={{ color: 'var(--text-3)', fontSize: 12, margin: 0 }}>Add moves in Team Builder to get damage suggestions.</p>
        </div>
      ) : (
        <div className="panel" style={{ overflow: 'hidden' }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: moveCols, gap: 6, alignItems: 'center', padding: '7px 12px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            <span className="hud-label" style={{ fontSize: 9 }}>Move</span>
            <span className="hud-label" style={{ fontSize: 9 }}>Type</span>
            <span className="hud-label" style={{ fontSize: 9 }}>Cat</span>
            <span className="hud-label" style={{ fontSize: 9 }}>BP</span>
            {theirLeads.map((opp, i) => (
              <span key={i} className="hud-label" style={{ fontSize: 9, textAlign: 'right', textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {opp.pokemon.name.replace(/-/g, ' ')}
              </span>
            ))}
          </div>

          {/* Move rows */}
          {moves.map((sug, idx) => {
            const rollsOpen = expandedRolls.has(sug.slug);
            const isBest = idx === 0 && !sug.weatherNullified && sug.bestEffectiveness > 0;
            const dimmed = sug.weatherNullified || sug.bestEffectiveness === 0;
            return (
              <div key={sug.slug} style={{
                borderBottom: '1px solid var(--line)',
                opacity: dimmed ? 0.4 : 1,
                background: isBest ? 'rgba(255,179,0,.04)' : 'transparent',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: moveCols, gap: 6, alignItems: 'center', padding: '8px 12px' }}>
                  {/* Move name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    {isBest && <span style={{ color: 'var(--amber)', fontSize: 10, flexShrink: 0 }}>★</span>}
                    <span className="hud-title" style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sug.displayName}</span>
                    {sug.move.basePower > 0 && !sug.weatherNullified && (
                      <button
                        onClick={() => setExpandedRolls(prev => { const s = new Set(prev); rollsOpen ? s.delete(sug.slug) : s.add(sug.slug); return s; })}
                        style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--text-3)', fontSize: 9, padding: 0, flexShrink: 0, marginLeft: 2, lineHeight: 1 }}>
                        {rollsOpen ? '▲' : '▼'}
                      </button>
                    )}
                  </div>

                  <TypeBadge type={sug.move.type} size="sm" />

                  <span className="mono" style={{ fontSize: 9, color: sug.move.category === 'physical' ? '#FF6B35' : sug.move.category === 'special' ? '#4D9DE0' : 'var(--text-3)' }}>
                    {sug.move.category === 'physical' ? 'PHYS' : sug.move.category === 'special' ? 'SPEC' : 'STAT'}
                  </span>

                  <span className="mono" style={{ fontSize: 10, color: 'var(--text-2)' }}>
                    {sug.move.basePower > 0 ? sug.move.basePower : '—'}
                  </span>

                  {/* Per-defender results */}
                  {sug.results.map((res, ri) => {
                    const showDmg = !sug.weatherNullified && res.effectiveness > 0 && sug.move.basePower > 0;
                    return (
                      <div key={ri} style={{ textAlign: 'right' }}>
                        {!showDmg ? (
                          <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)' }}>
                            {sug.weatherNullified ? 'NULL' : res.effectiveness === 0 ? 'IMM' : '—'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
                            <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-0)' }}>{res.minPct}–{res.maxPct}%</span>
                            <div style={{ width: '100%', maxWidth: 80, height: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.min(res.maxPct, 100)}%`, background: res.maxPct >= 100 ? 'var(--accent)' : res.maxPct >= 50 ? 'var(--amber)' : 'var(--cyan)' }} />
                            </div>
                            {res.koPct === 100 && <span className="mono" style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>GUARANTEED KO</span>}
                            {res.koPct > 0 && res.koPct < 100 && <span className="mono" style={{ fontSize: 9, color: 'var(--amber)' }}>{res.koPct}% KO</span>}
                            {res.stab && <span className="mono" style={{ fontSize: 8, color: 'var(--amber)', opacity: 0.6 }}>STAB</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 16-roll expansion */}
                {rollsOpen && (
                  <div style={{ padding: '6px 12px 10px', borderTop: '1px solid var(--line)', background: 'var(--bg-0)' }}>
                    {sug.results.map((res, ri) => {
                      if (!res.rolls.length) return null;
                      const defHP  = res.maxPct > 0 ? Math.round(res.rolls[15] / (res.maxPct / 100)) : 0;
                      const koCount = res.rolls.filter(r => defHP > 0 && r >= defHP).length;
                      return (
                        <div key={ri} style={{ marginBottom: 6 }}>
                          <span className="hud-label" style={{ fontSize: 8, marginRight: 8, color: 'var(--text-3)' }}>
                            {res.defender.pokemon.name.replace(/-/g, ' ')} ({koCount}/16 KO):
                          </span>
                          <div style={{ display: 'inline-flex', gap: 2, flexWrap: 'wrap', marginTop: 3 }}>
                            {res.rolls.map((r, i2) => {
                              const ko = defHP > 0 && r >= defHP;
                              return (
                                <span key={i2} className="mono" style={{ fontSize: 9, padding: '1px 4px', background: ko ? 'var(--accent-soft)' : 'var(--bg-2)', border: `1px solid ${ko ? 'var(--accent)' : 'var(--line)'}`, color: ko ? 'var(--accent)' : 'var(--text-2)', fontWeight: ko ? 700 : 400 }}>
                                  {r}
                                </span>
                              );
                            })}
                          </div>
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

      <p className="mono" style={{ fontSize: 9, color: 'var(--text-3)', margin: 0 }}>
        Damage uses inferred builds. Actual results vary with items, abilities, and spreads. Flying-types treated as ungrounded.
      </p>
    </div>
  );
}
