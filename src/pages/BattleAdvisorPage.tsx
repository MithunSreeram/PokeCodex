import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTeamStore } from '../store/teamStore';
import type { Team, TeamMember } from '../store/teamStore';
import { fetchPokemon } from '../api/pokeapi';
import { inferOpponent } from '../utils/opponentInference';
import type { InferredOpponent } from '../utils/opponentInference';
import { suggestPick } from '../utils/teamSelector';
import type { ScoredMember } from '../utils/teamSelector';
import { TypeBadge } from '../components/ui/TypeBadge';
import { MoveAdvisor } from '../components/battle/MoveAdvisor';
import { Spinner } from '../components/ui/Spinner';

type Step = 'team-select' | 'opponent-input' | 'brings' | 'leads' | 'advisor';
type Format = 'singles' | 'doubles';

function pokeSprite(poke: {
  sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } };
}): string {
  return poke.sprites.other?.['official-artwork']?.front_default ?? poke.sprites.front_default ?? '';
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'team-select',    label: 'TEAM'     },
  { key: 'opponent-input', label: 'OPPONENT' },
  { key: 'brings',         label: 'PICKS'    },
  { key: 'leads',          label: 'LEADS'    },
  { key: 'advisor',        label: 'MOVES'    },
];

export function BattleAdvisorPage() {
  const { teams } = useTeamStore();

  const [step,   setStep]   = useState<Step>('team-select');
  const [team,   setTeam]   = useState<Team | null>(null);
  const [format, setFormat] = useState<Format>('doubles');

  const [oppNames,   setOppNames]   = useState<string[]>(Array(6).fill(''));
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [oppErrors,  setOppErrors]  = useState<string[]>(Array(6).fill(''));
  const [opponents,  setOpponents]  = useState<InferredOpponent[]>([]);

  const bringCount = format === 'singles' ? 3 : 4;
  const [recommended,    setRecommended]    = useState<ScoredMember[]>([]);
  const [customBringIds, setCustomBringIds] = useState<Set<string> | null>(null);

  const currentBringIds: Set<string> = customBringIds ?? new Set(recommended.map(s => s.member.id));
  const brings: TeamMember[] = team?.members.filter(m => currentBringIds.has(m.id)) ?? [];

  const leadCount = format === 'singles' ? 1 : 2;
  const [ourLeadIds,     setOurLeadIds]    = useState<Set<string>>(new Set());
  const [theirLeadIdxs,  setTheirLeadIdxs] = useState<Set<number>>(new Set());

  const ourLeads   = brings.filter((m)       => ourLeadIds.has(m.id));
  const theirLeads = opponents.filter((_, i) => theirLeadIdxs.has(i));
  const ourBench   = brings.filter((m)       => !ourLeadIds.has(m.id));
  const theirBench = opponents.filter((_, i) => !theirLeadIdxs.has(i));

  async function analyzeOpponents() {
    setLoadingOpp(true);
    const errors = Array<string>(6).fill('');
    const valid: InferredOpponent[] = [];
    for (let i = 0; i < 6; i++) {
      const raw = oppNames[i].trim();
      if (!raw) continue;
      const slug = raw.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      try {
        const poke = await fetchPokemon(slug);
        valid.push(inferOpponent(poke));
      } catch {
        errors[i] = `"${raw}" not found`;
      }
    }
    setOppErrors(errors);
    setOpponents(valid);
    if (valid.length > 0 && team && team.members.length > 0) {
      const picks = suggestPick(team.members, valid, bringCount as 3 | 4);
      setRecommended(picks);
      setCustomBringIds(null);
    }
    setLoadingOpp(false);
    if (valid.length > 0) setStep('brings');
  }

  function toggleBring(id: string) {
    const base = new Set(currentBringIds);
    if (base.has(id)) { if (base.size > 1) base.delete(id); }
    else if (base.size < bringCount) base.add(id);
    setCustomBringIds(base);
  }

  function toggleOurLead(id: string) {
    setOurLeadIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < leadCount) next.add(id);
      return next;
    });
  }

  function toggleTheirLead(idx: number) {
    setTheirLeadIdxs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else if (next.size < leadCount) next.add(idx);
      return next;
    });
  }

  function switchOurLead(outId: string, inId: string) {
    setOurLeadIds(prev => { const next = new Set(prev); next.delete(outId); next.add(inId); return next; });
  }

  function switchTheirLead(outName: string, inName: string) {
    const outIdx = opponents.findIndex(o => o.pokemon.name === outName);
    const inIdx  = opponents.findIndex(o => o.pokemon.name === inName);
    if (outIdx < 0 || inIdx < 0) return;
    setTheirLeadIdxs(prev => { const next = new Set(prev); next.delete(outIdx); next.add(inIdx); return next; });
  }

  function fullReset() {
    setStep('team-select'); setTeam(null);
    setOppNames(Array(6).fill('')); setOppErrors(Array(6).fill(''));
    setOpponents([]); setRecommended([]); setCustomBringIds(null);
    setOurLeadIds(new Set()); setTheirLeadIdxs(new Set());
  }

  const stepIdx = STEPS.findIndex(s => s.key === step);
  const minMembers = bringCount;

  return (
    <div style={{ minHeight: '100vh' }}>
      <div className="wrap-wide" style={{ paddingTop: 20, paddingBottom: 48, maxWidth: 900 }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <div className="hud-label" style={{ marginBottom: 4 }}>// THE CODEX — MODULE 03</div>
          <h1 className="hud-title" style={{ margin: 0, fontSize: 28 }}>
            <span style={{ color: 'var(--accent)' }}>BATTLE</span> ADVISOR
          </h1>
        </div>

        {/* Progress rail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 12px',
                background: i === stepIdx ? 'var(--accent)' : i < stepIdx ? 'var(--accent-soft)' : 'var(--bg-2)',
                border: `1px solid ${i === stepIdx ? 'var(--accent)' : i < stepIdx ? 'rgba(255,45,58,.3)' : 'var(--line-hard)'}`,
              }}>
                <span className="mono" style={{ fontSize: 9, color: i === stepIdx ? '#0a0b0e' : i < stepIdx ? 'var(--accent)' : 'var(--text-3)' }}>{i + 1}</span>
                <span className="hud-label" style={{ fontSize: 9, color: i === stepIdx ? '#0a0b0e' : i < stepIdx ? 'var(--text-1)' : 'var(--text-3)' }}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ width: 16, height: 1, background: i < stepIdx ? 'var(--accent)' : 'var(--line-hard)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step 1: Team Select ──────────────────────────────────────────── */}
        {step === 'team-select' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="panel">
              <div className="panel-head"><span className="dot" /><h3>Select Your Team</h3></div>
              <div style={{ padding: 14 }}>
                {teams.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <p style={{ color: 'var(--text-2)', marginBottom: 10, fontSize: 13 }}>No teams saved yet.</p>
                    <Link to="/team-builder" style={{ color: 'var(--accent)', fontSize: 12, fontFamily: 'Chakra Petch', fontWeight: 600 }}>
                      BUILD A TEAM FIRST →
                    </Link>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
                    {teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTeam(t)}
                        style={{
                          appearance: 'none', cursor: 'pointer', textAlign: 'left', padding: '12px 14px',
                          border: `1px solid ${team?.id === t.id ? 'var(--accent)' : 'var(--line-hard)'}`,
                          background: team?.id === t.id ? 'var(--accent-soft)' : 'var(--bg-2)',
                          transition: 'all .1s',
                        }}
                        onMouseEnter={e => { if (team?.id !== t.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-2)'; }}
                        onMouseLeave={e => { if (team?.id !== t.id) (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-hard)'; }}
                      >
                        <div className="hud-title" style={{ fontSize: 13, marginBottom: 3 }}>{t.name}</div>
                        <div className="hud-label" style={{ fontSize: 9, marginBottom: 8 }}>
                          {t.format} · {t.members.length}/6
                        </div>
                        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                          {t.members.map(m => (
                            <img key={m.id} src={m.pokemon.sprites.front_default ?? ''} alt={m.pokemon.name} style={{ width: 36, height: 36, objectFit: 'contain' }} />
                          ))}
                        </div>
                        {t.members.length < minMembers && (
                          <p style={{ margin: '6px 0 0', fontSize: 10, color: 'var(--amber)' }}>
                            Needs at least {minMembers} Pokémon for {format}.
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head"><span className="dot" /><h3>Battle Format</h3></div>
              <div style={{ padding: 14, display: 'flex', gap: 10 }}>
                {(['singles', 'doubles'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`btn ${format === f ? 'btn-primary' : ''}`}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3, padding: '10px 18px' }}
                  >
                    <span style={{ fontSize: 13, letterSpacing: '.05em' }}>{f.toUpperCase()}</span>
                    <span className="mono" style={{ fontSize: 9, letterSpacing: 0, textTransform: 'none', color: format === f ? 'rgba(0,0,0,.6)' : 'var(--text-3)', fontWeight: 400 }}>
                      {f === 'singles' ? 'Bring 3 · 1 lead' : 'Bring 4 · 2 leads'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <button
              disabled={!team || team.members.length < minMembers}
              onClick={() => setStep('opponent-input')}
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', padding: '10px 24px', fontSize: 13, opacity: (!team || team.members.length < minMembers) ? 0.4 : 1 }}
            >
              NEXT: OPPONENT'S TEAM →
            </button>
          </div>
        )}

        {/* ── Step 2: Opponent Input ───────────────────────────────────────── */}
        {step === 'opponent-input' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="panel">
              <div className="panel-head"><span className="dot" /><h3>Opponent's Team</h3></div>
              <div style={{ padding: 14 }}>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  Enter your opponent's Pokémon names — we'll infer likely EVs, nature, and moves from competitive norms.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {oppNames.map((name, i) => (
                    <div key={i}>
                      <input
                        type="text"
                        placeholder={`Pokémon ${i + 1}${i >= 4 ? ' (optional)' : ''}`}
                        value={name}
                        onChange={e => setOppNames(prev => { const n = [...prev]; n[i] = e.target.value; return n; })}
                        onKeyDown={e => { if (e.key === 'Enter') void analyzeOpponents(); }}
                        className="ipt"
                        style={{ borderColor: oppErrors[i] ? 'var(--accent)' : undefined }}
                      />
                      {oppErrors[i] && <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--accent)' }}>{oppErrors[i]}</p>}
                    </div>
                  ))}
                </div>
                <p className="mono" style={{ margin: '10px 0 0', fontSize: 10, color: 'var(--text-3)' }}>
                  Use standard name (e.g. "Flutter Mane") or slug (e.g. "raichu-alola")
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('team-select')} className="btn">← BACK</button>
              <button
                onClick={() => void analyzeOpponents()}
                disabled={loadingOpp || oppNames.every(n => !n.trim())}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: (loadingOpp || oppNames.every(n => !n.trim())) ? 0.5 : 1 }}
              >
                {loadingOpp ? <><Spinner size={3} /> FETCHING…</> : 'ANALYZE TEAM →'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Brings ───────────────────────────────────────────────── */}
        {step === 'brings' && team && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Opponent overview */}
            <div className="panel">
              <div className="panel-head"><span className="dot" /><h3>Opponent's Team</h3></div>
              <div style={{ padding: 14, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {opponents.map((opp, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 64 }}>
                    <img src={pokeSprite(opp.pokemon)} alt={opp.pokemon.name} style={{ width: 56, height: 56, objectFit: 'contain' }} />
                    <span style={{ fontSize: 10, color: 'var(--text-1)', textTransform: 'capitalize', textAlign: 'center' }}>
                      {opp.pokemon.name.replace(/-/g, ' ')}
                    </span>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                    </div>
                    <span className="hud-label" style={{ fontSize: 8 }}>{opp.role}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Our team toggles */}
            <div className="panel">
              <div className="panel-head">
                <span className="dot" />
                <h3>Your Picks</h3>
                <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-2)' }}>
                  {currentBringIds.size}/{bringCount}
                </span>
              </div>
              <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {team.members.map(member => {
                  const isSelected = currentBringIds.has(member.id);
                  const scored     = recommended.find(s => s.member.id === member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleBring(member.id)}
                      style={{
                        appearance: 'none', cursor: 'pointer', textAlign: 'left', padding: '10px 12px',
                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--line-hard)'}`,
                        background: isSelected ? 'var(--accent-soft)' : 'var(--bg-2)',
                        opacity: isSelected ? 1 : 0.55,
                        transition: 'all .1s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={pokeSprite(member.pokemon)} alt={member.pokemon.name} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="hud-title" style={{ fontSize: 12, textTransform: 'capitalize', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {member.nickname || member.pokemon.name.replace(/-/g, ' ')}
                          </div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                          </div>
                        </div>
                        {scored && <span className="tag tag-amber" style={{ fontSize: 8 }}>★</span>}
                      </div>
                      {scored && scored.reasons.length > 0 && (
                        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {scored.reasons.map((r, ri) => (
                            <p key={ri} className="mono" style={{ margin: 0, fontSize: 9, color: 'var(--text-3)' }}>· {r}</p>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('opponent-input')} className="btn">← BACK</button>
              <button
                disabled={currentBringIds.size !== bringCount}
                onClick={() => { setOurLeadIds(new Set()); setTheirLeadIdxs(new Set()); setStep('leads'); }}
                className="btn btn-primary"
                style={{ opacity: currentBringIds.size !== bringCount ? 0.4 : 1 }}
              >
                CONFIRM PICKS →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Lead Selection ───────────────────────────────────────── */}
        {step === 'leads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Our leads */}
              <div className="panel">
                <div className="panel-head">
                  <span className="dot" style={{ background: 'var(--cyan)' }} />
                  <h3 style={{ color: 'var(--cyan)' }}>YOUR LEADS</h3>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-2)' }}>{ourLeadIds.size}/{leadCount}</span>
                </div>
                <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {brings.map(member => {
                    const selected = ourLeadIds.has(member.id);
                    return (
                      <button
                        key={member.id}
                        onClick={() => toggleOurLead(member.id)}
                        style={{
                          appearance: 'none', cursor: 'pointer', padding: '10px 8px',
                          border: `1px solid ${selected ? 'var(--cyan)' : 'var(--line-hard)'}`,
                          background: selected ? 'rgba(43,217,255,.08)' : 'var(--bg-2)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          transition: 'all .1s',
                        }}
                      >
                        <img src={pokeSprite(member.pokemon)} alt={member.pokemon.name} style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        <span style={{ fontSize: 10, color: 'var(--text-1)', textTransform: 'capitalize', textAlign: 'center' }}>
                          {member.nickname || member.pokemon.name.replace(/-/g, ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Their leads */}
              <div className="panel">
                <div className="panel-head">
                  <span className="dot" />
                  <h3 style={{ color: 'var(--accent)' }}>THEIR LEADS</h3>
                  <span className="mono" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-2)' }}>{theirLeadIdxs.size}/{leadCount}</span>
                </div>
                <div style={{ padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {opponents.map((opp, i) => {
                    const selected = theirLeadIdxs.has(i);
                    return (
                      <button
                        key={i}
                        onClick={() => toggleTheirLead(i)}
                        style={{
                          appearance: 'none', cursor: 'pointer', padding: '10px 8px',
                          border: `1px solid ${selected ? 'var(--accent)' : 'var(--line-hard)'}`,
                          background: selected ? 'var(--accent-soft)' : 'var(--bg-2)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                          transition: 'all .1s',
                        }}
                      >
                        <img src={pokeSprite(opp.pokemon)} alt={opp.pokemon.name} style={{ width: 52, height: 52, objectFit: 'contain' }} />
                        <span style={{ fontSize: 10, color: 'var(--text-1)', textTransform: 'capitalize', textAlign: 'center' }}>
                          {opp.pokemon.name.replace(/-/g, ' ')}
                        </span>
                        <div style={{ display: 'flex', gap: 3 }}>
                          {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                        </div>
                        <span className="hud-label" style={{ fontSize: 8, color: 'var(--text-3)' }}>{opp.nature} · {opp.role}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep('brings')} className="btn">← BACK</button>
              <button
                disabled={ourLeadIds.size !== leadCount || theirLeadIdxs.size !== leadCount}
                onClick={() => setStep('advisor')}
                className="btn btn-primary"
                style={{ opacity: (ourLeadIds.size !== leadCount || theirLeadIdxs.size !== leadCount) ? 0.4 : 1 }}
              >
                GET MOVE SUGGESTIONS →
              </button>
            </div>
          </div>
        )}

        {/* ── Step 5: Move Advisor ─────────────────────────────────────────── */}
        {step === 'advisor' && (
          <MoveAdvisor
            ourLeads={ourLeads}
            theirLeads={theirLeads}
            ourBench={ourBench}
            theirBench={theirBench}
            onSwitchOurLead={switchOurLead}
            onSwitchTheirLead={switchTheirLead}
            onBack={() => setStep('leads')}
            onReset={fullReset}
          />
        )}
      </div>
    </div>
  );
}
