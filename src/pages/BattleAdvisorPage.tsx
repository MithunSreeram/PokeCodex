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

type Step = 'team-select' | 'opponent-input' | 'brings' | 'leads' | 'advisor';
type Format = 'singles' | 'doubles';

function pokeSprite(poke: {
  sprites: { front_default: string | null; other?: { 'official-artwork'?: { front_default: string | null } } };
}): string {
  return poke.sprites.other?.['official-artwork']?.front_default ?? poke.sprites.front_default ?? '';
}

const STEPS: { key: Step; label: string }[] = [
  { key: 'team-select',    label: 'Your Team' },
  { key: 'opponent-input', label: 'Opponent'  },
  { key: 'brings',         label: 'Picks'     },
  { key: 'leads',          label: 'Leads'     },
  { key: 'advisor',        label: 'Moves'     },
];

export function BattleAdvisorPage() {
  const { teams } = useTeamStore();

  const [step,   setStep]   = useState<Step>('team-select');
  const [team,   setTeam]   = useState<Team | null>(null);
  const [format, setFormat] = useState<Format>('doubles');

  // ── Step 2 ────────────────────────────────────────────────────────────────
  const [oppNames,   setOppNames]   = useState<string[]>(Array(6).fill(''));
  const [loadingOpp, setLoadingOpp] = useState(false);
  const [oppErrors,  setOppErrors]  = useState<string[]>(Array(6).fill(''));
  const [opponents,  setOpponents]  = useState<InferredOpponent[]>([]);

  // ── Step 3 ────────────────────────────────────────────────────────────────
  const bringCount = format === 'singles' ? 3 : 4;
  const [recommended,    setRecommended]    = useState<ScoredMember[]>([]);
  const [customBringIds, setCustomBringIds] = useState<Set<string> | null>(null);

  const currentBringIds: Set<string> =
    customBringIds ?? new Set(recommended.map(s => s.member.id));
  const brings: TeamMember[] = team?.members.filter(m => currentBringIds.has(m.id)) ?? [];

  // ── Step 4 ────────────────────────────────────────────────────────────────
  const leadCount = format === 'singles' ? 1 : 2;
  const [ourLeadIds,    setOurLeadIds]    = useState<Set<string>>(new Set());
  const [theirLeadIdxs, setTheirLeadIdxs] = useState<Set<number>>(new Set());

  const ourLeads   = brings.filter((m)       => ourLeadIds.has(m.id));
  const theirLeads = opponents.filter((_, i) => theirLeadIdxs.has(i));
  const ourBench   = brings.filter((m)       => !ourLeadIds.has(m.id));
  const theirBench = opponents.filter((_, i) => !theirLeadIdxs.has(i));

  // ── Handlers ──────────────────────────────────────────────────────────────

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
    if (base.has(id)) {
      if (base.size > 1) base.delete(id);
    } else if (base.size < bringCount) {
      base.add(id);
    }
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
    setOurLeadIds(prev => {
      const next = new Set(prev);
      next.delete(outId);
      next.add(inId);
      return next;
    });
  }

  function switchTheirLead(outName: string, inName: string) {
    const outIdx = opponents.findIndex(o => o.pokemon.name === outName);
    const inIdx  = opponents.findIndex(o => o.pokemon.name === inName);
    if (outIdx < 0 || inIdx < 0) return;
    setTheirLeadIdxs(prev => {
      const next = new Set(prev);
      next.delete(outIdx);
      next.add(inIdx);
      return next;
    });
  }

  function fullReset() {
    setStep('team-select');
    setTeam(null);
    setOppNames(Array(6).fill(''));
    setOppErrors(Array(6).fill(''));
    setOpponents([]);
    setRecommended([]);
    setCustomBringIds(null);
    setOurLeadIds(new Set());
    setTheirLeadIdxs(new Set());
  }

  // ── Step indicator ────────────────────────────────────────────────────────
  const stepIdx = STEPS.findIndex(s => s.key === step);

  // ── Min members for format ────────────────────────────────────────────────
  const minMembers = bringCount;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">

      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Battle Advisor</h1>
        <p className="text-gray-400 mt-1 text-sm">
          Upload your team, scout the opponent, and get move-by-move damage suggestions.
        </p>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < stepIdx  ? 'bg-red-600 text-white' :
              i === stepIdx ? 'bg-red-500 text-white ring-2 ring-red-400/40' :
                              'bg-gray-700 text-gray-500'
            }`}>{i + 1}</div>
            <span className={`text-xs hidden sm:block mr-1 ${
              i === stepIdx ? 'text-white' : i < stepIdx ? 'text-red-400' : 'text-gray-600'
            }`}>{s.label}</span>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-1 ${i < stepIdx ? 'bg-red-600' : 'bg-gray-700'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── Step 1: Team Select ────────────────────────────────────────────── */}
      {step === 'team-select' && (
        <div className="space-y-6">

          {/* Team list */}
          <div>
            <h2 className="text-white font-bold text-lg mb-3">Select Your Team</h2>
            {teams.length === 0 ? (
              <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 text-center">
                <p className="text-gray-400 mb-3">No teams saved yet.</p>
                <Link to="/team-builder" className="text-red-400 hover:text-red-300 text-sm underline">
                  Build a team first →
                </Link>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {teams.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setTeam(t)}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      team?.id === t.id
                        ? 'border-red-500 bg-red-950/40 ring-1 ring-red-500/30'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <div className="font-semibold text-white">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {t.format} · {t.members.length}/6 Pokémon
                    </div>
                    <div className="flex gap-0.5 mt-2 flex-wrap">
                      {t.members.map(m => (
                        <img
                          key={m.id}
                          src={m.pokemon.sprites.front_default ?? ''}
                          alt={m.pokemon.name}
                          className="w-9 h-9 object-contain"
                        />
                      ))}
                    </div>
                    {t.members.length < minMembers && (
                      <p className="text-xs text-yellow-500 mt-2">
                        Needs at least {minMembers} Pokémon for {format}.
                      </p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Format selector */}
          <div>
            <h2 className="text-white font-bold text-lg mb-3">Battle Format</h2>
            <div className="flex gap-3">
              {(['singles', 'doubles'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-6 py-3 rounded-xl font-semibold text-sm capitalize transition-colors ${
                    format === f
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-800 border border-gray-700 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  {f}
                  <div className="text-xs font-normal opacity-70 mt-0.5">
                    {f === 'singles' ? 'Bring 3 · 1 lead' : 'Bring 4 · 2 leads'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={!team || team.members.length < minMembers}
            onClick={() => setStep('opponent-input')}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            Next: Enter Opponent's Team →
          </button>
        </div>
      )}

      {/* ── Step 2: Opponent Input ─────────────────────────────────────────── */}
      {step === 'opponent-input' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-white font-bold text-lg">Opponent's Team</h2>
            <p className="text-gray-400 text-sm mt-1">
              Enter the names of your opponent's Pokémon — just the name is enough. We'll infer
              their likely EVs, IVs, nature, and moves from competitive norms.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {oppNames.map((name, i) => (
              <div key={i}>
                <input
                  type="text"
                  placeholder={`Pokémon ${i + 1}${i >= 4 ? ' (optional)' : ''}`}
                  value={name}
                  onChange={e => setOppNames(prev => {
                    const n = [...prev]; n[i] = e.target.value; return n;
                  })}
                  onKeyDown={e => { if (e.key === 'Enter') void analyzeOpponents(); }}
                  className={`w-full bg-gray-800 border ${
                    oppErrors[i] ? 'border-red-500' : 'border-gray-700'
                  } rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500 text-sm`}
                />
                {oppErrors[i] && (
                  <p className="text-red-400 text-xs mt-1">{oppErrors[i]}</p>
                )}
              </div>
            ))}
          </div>

          <p className="text-gray-600 text-xs">
            Use the Pokémon's standard English name (e.g. "Flutter Mane", "Iron Bundle").
            Regional forms: "Alolan Raichu" → type "raichu-alola".
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('team-select')}
              className="px-5 py-2.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => void analyzeOpponents()}
              disabled={loadingOpp || oppNames.every(n => !n.trim())}
              className="px-8 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center gap-2"
            >
              {loadingOpp ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Fetching…
                </>
              ) : 'Analyze Team →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Brings ────────────────────────────────────────────────── */}
      {step === 'brings' && team && (
        <div className="space-y-6">
          <div>
            <h2 className="text-white font-bold text-lg">Team Picks</h2>
            <p className="text-gray-400 text-sm mt-1">
              For {format}, bring {bringCount} Pokémon. Recommended picks are pre-selected —
              click to override.
            </p>
          </div>

          {/* Opponent overview */}
          <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
            <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">
              Opponent's Team
            </h3>
            <div className="flex gap-4 flex-wrap">
              {opponents.map((opp, i) => (
                <div key={i} className="flex flex-col items-center gap-1 min-w-[64px]">
                  <img
                    src={pokeSprite(opp.pokemon)}
                    alt={opp.pokemon.name}
                    className="w-14 h-14 object-contain"
                  />
                  <span className="text-xs text-gray-300 capitalize text-center leading-tight">
                    {opp.pokemon.name.replace(/-/g, ' ')}
                  </span>
                  <div className="flex gap-0.5 flex-wrap justify-center">
                    {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                  </div>
                  <span className="text-xs text-gray-500">{opp.role}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Our team with toggles */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm text-gray-300 font-semibold">Your Team</h3>
              <span className="text-xs text-gray-500">
                {currentBringIds.size}/{bringCount} selected
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {team.members.map(member => {
                const isSelected = currentBringIds.has(member.id);
                const scored     = recommended.find(s => s.member.id === member.id);
                return (
                  <button
                    key={member.id}
                    onClick={() => toggleBring(member.id)}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-950/30 ring-1 ring-red-500/20'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600 opacity-55 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <img
                        src={pokeSprite(member.pokemon)}
                        alt={member.pokemon.name}
                        className="w-11 h-11 object-contain"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white capitalize text-sm truncate">
                          {member.nickname || member.pokemon.name.replace(/-/g, ' ')}
                        </div>
                        <div className="flex gap-0.5 mt-0.5 flex-wrap">
                          {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {isSelected && <span className="text-green-400 text-sm">✓</span>}
                        {scored && (
                          <span className="text-xs text-yellow-500/80 font-medium">★ Rec</span>
                        )}
                      </div>
                    </div>
                    {scored && scored.reasons.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {scored.reasons.map((r, ri) => (
                          <p key={ri} className="text-xs text-gray-400">• {r}</p>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('opponent-input')}
              className="px-5 py-2.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              disabled={currentBringIds.size !== bringCount}
              onClick={() => {
                setOurLeadIds(new Set());
                setTheirLeadIdxs(new Set());
                setStep('leads');
              }}
              className="px-8 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              Confirm Picks →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Lead Selection ────────────────────────────────────────── */}
      {step === 'leads' && (
        <div className="space-y-6">
          <div>
            <h2 className="text-white font-bold text-lg">Select Leads</h2>
            <p className="text-gray-400 text-sm mt-1">
              {format === 'doubles'
                ? "Pick the 2 Pokémon you'll lead with and the 2 your opponent is leading."
                : 'Pick the lead Pokémon for each side.'}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Our leads */}
            <div>
              <h3 className="text-sm font-bold text-blue-300 mb-3">
                Your Leads
                <span className="text-gray-500 font-normal ml-2 text-xs">
                  ({ourLeadIds.size}/{leadCount})
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {brings.map(member => {
                  const selected = ourLeadIds.has(member.id);
                  return (
                    <button
                      key={member.id}
                      onClick={() => toggleOurLead(member.id)}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                        selected
                          ? 'border-blue-500 bg-blue-950/30 ring-1 ring-blue-400/30'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <img src={pokeSprite(member.pokemon)} className="w-14 h-14 object-contain" alt={member.pokemon.name} />
                      <span className="text-xs text-gray-200 capitalize mt-1 text-center leading-tight">
                        {member.nickname || member.pokemon.name.replace(/-/g, ' ')}
                      </span>
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Their leads */}
            <div>
              <h3 className="text-sm font-bold text-red-300 mb-3">
                Their Leads
                <span className="text-gray-500 font-normal ml-2 text-xs">
                  ({theirLeadIdxs.size}/{leadCount})
                </span>
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {opponents.map((opp, i) => {
                  const selected = theirLeadIdxs.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleTheirLead(i)}
                      className={`flex flex-col items-center p-3 rounded-xl border transition-all ${
                        selected
                          ? 'border-red-500 bg-red-950/30 ring-1 ring-red-400/30'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <img src={pokeSprite(opp.pokemon)} className="w-14 h-14 object-contain" alt={opp.pokemon.name} />
                      <span className="text-xs text-gray-200 capitalize mt-1 text-center leading-tight">
                        {opp.pokemon.name.replace(/-/g, ' ')}
                      </span>
                      <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                        {opp.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
                      </div>
                      <span className="text-xs text-gray-500 mt-0.5">{opp.nature} · {opp.role}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('brings')}
              className="px-5 py-2.5 rounded-xl bg-gray-800 border border-gray-700 hover:border-gray-600 text-gray-300 text-sm font-medium transition-colors"
            >
              ← Back
            </button>
            <button
              disabled={ourLeadIds.size !== leadCount || theirLeadIdxs.size !== leadCount}
              onClick={() => setStep('advisor')}
              className="px-8 py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
            >
              Get Move Suggestions →
            </button>
          </div>
        </div>
      )}

      {/* ── Step 5: Move Advisor ──────────────────────────────────────────── */}
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
  );
}
