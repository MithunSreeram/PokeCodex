import type { Team, VGCRole } from '../../store/teamStore';
import { getTeamWeaknessMatrix } from '../../utils/typeChart';
import { TYPE_COLORS } from '../../utils/typeColors';
import { teamToShowdown } from '../../utils/showdownExport';
import { calcStat, STAT_API_TO_KEY } from '../../utils/statCalc';

const VGC_CORE_ROLES: VGCRole[] = [
  'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
  'Redirector', 'Speed Control',
];

const CHAMPIONS_CORE_ROLES: VGCRole[] = [
  'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
  'Redirector', 'Pivot', 'Speed Control',
];

interface Props {
  team: Team;
}

export function TeamAnalysisPanel({ team }: Props) {
  const isChampions = team.format === 'Pokémon Champions';
  const memberTypes = team.members.map(m => m.pokemon.types);
  const weakMatrix = getTeamWeaknessMatrix(memberTypes);
  const presentRoles = new Set(team.members.map(m => m.role));
  const coreRoles = isChampions ? CHAMPIONS_CORE_ROLES : VGC_CORE_ROLES;
  const missingRoles = coreRoles.filter(r => !presentRoles.has(r));

  const restrictedCount = team.members.filter(m => m.isRestricted).length;
  const restrictedOk = restrictedCount <= 2;

  // Calculated speed tiers using EVs / IVs / Nature
  const speedTiers = [...team.members]
    .map(m => {
      const baseSpe = m.pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;
      const spe = calcStat(baseSpe, m.evs.spe, m.ivs.spe, m.nature, STAT_API_TO_KEY['speed']);
      return { name: m.nickname || m.pokemon.name, spe };
    })
    .sort((a, b) => b.spe - a.spe);

  // Offensive type coverage (unique types the team can hit)
  const offensiveTypes = [...new Set(team.members.flatMap(m => m.pokemon.types))];

  function copyShowdown() {
    navigator.clipboard.writeText(teamToShowdown(team.members));
  }

  return (
    <div className="space-y-4">
      {/* Format Info */}
      <div className={`rounded-2xl p-4 border ${isChampions ? 'bg-blue-950/40 border-blue-700/50' : 'bg-gray-800 border-gray-700'}`}>
        <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Format</h3>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-semibold">{team.format}</p>
          {isChampions && (
            <span className="text-xs bg-blue-600/30 text-blue-300 border border-blue-600/40 px-2 py-0.5 rounded-full font-bold">
              Champions
            </span>
          )}
        </div>

        {isChampions ? (
          <div className="mt-2 space-y-1 text-xs">
            <p className="text-blue-300">✓ No restricted Pokémon</p>
            <p className="text-blue-300">✓ Standard team of 6</p>
            <p className="text-blue-300">✓ Curated Pokémon pool</p>
          </div>
        ) : (
          <div className={`mt-2 text-xs font-medium ${restrictedOk ? 'text-green-400' : 'text-red-400'}`}>
            {restrictedCount}/2 Restricted slots used
            {!restrictedOk && ' — exceeds limit!'}
          </div>
        )}
      </div>

      {/* Missing Roles */}
      {missingRoles.length > 0 && (
        <div className="bg-yellow-900/30 rounded-2xl p-4 border border-yellow-700/50">
          <h3 className="text-xs text-yellow-400 uppercase font-bold tracking-wider mb-2">Missing Roles</h3>
          <div className="flex flex-wrap gap-1.5">
            {missingRoles.map(r => (
              <span key={r} className="px-2 py-0.5 bg-yellow-800/50 text-yellow-300 rounded-lg text-xs">
                {r}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Calculated Speed Tiers */}
      {speedTiers.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">
            Speed Tiers <span className="text-gray-600 normal-case font-normal">(Lv.50, with EVs)</span>
          </h3>
          <div className="space-y-1.5">
            {speedTiers.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 capitalize w-28 truncate">{s.name.replace(/-/g, ' ')}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-400 rounded-full"
                    style={{ width: `${Math.min((s.spe / 350) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-pink-300 font-mono w-8 text-right">{s.spe}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-xs mt-2">
            Tailwind ×2 · Trick Room reverses order
          </p>
        </div>
      )}

      {/* Team Weaknesses */}
      {Object.keys(weakMatrix).length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Team Weaknesses</h3>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(weakMatrix)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const colors = TYPE_COLORS[type] ?? { bg: '#555', text: '#fff' };
                return (
                  <div
                    key={type}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    <span className="capitalize">{type}</span>
                    <span className="opacity-75">×{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Offensive Coverage */}
      {offensiveTypes.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Type Coverage</h3>
          <div className="flex flex-wrap gap-1.5">
            {offensiveTypes.map(type => {
              const colors = TYPE_COLORS[type] ?? { bg: '#555', text: '#fff' };
              return (
                <span
                  key={type}
                  className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                  style={{ background: colors.bg, color: colors.text }}
                >
                  {type}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Export */}
      {team.members.length > 0 && (
        <button
          onClick={copyShowdown}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
        >
          Copy Showdown Export
        </button>
      )}
    </div>
  );
}
