import { Team, VGCRole } from '../../types/team';
import { getTeamWeaknessMatrix } from '../../utils/typeChart';
import { TYPE_COLORS } from '../../utils/typeColors';
import { teamToShowdown } from '../../utils/showdownExport';

const CORE_ROLES: VGCRole[] = [
  'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
  'Redirector', 'Speed Control',
];

interface Props {
  team: Team;
}

export function TeamAnalysisPanel({ team }: Props) {
  const memberTypes = team.members.map(m => m.pokemon.types);
  const weakMatrix = getTeamWeaknessMatrix(memberTypes);
  const presentRoles = new Set(team.members.map(m => m.role));
  const missingRoles = CORE_ROLES.filter(r => !presentRoles.has(r));

  const restrictedCount = team.members.filter(m => m.isRestricted).length;
  const restrictedOk = restrictedCount <= 2;

  const speedTiers = [...team.members]
    .map(m => {
      const speStat = m.pokemon.stats.find(s => s.name === 'speed')?.base ?? 0;
      return { name: m.nickname || m.pokemon.name, speed: speStat };
    })
    .sort((a, b) => b.speed - a.speed);

  function copyShowdown() {
    navigator.clipboard.writeText(teamToShowdown(team.members));
  }

  return (
    <div className="space-y-5">
      {/* Format Info */}
      <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
        <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-2">Format</h3>
        <p className="text-white font-semibold">{team.format}</p>
        <div className={`mt-2 text-xs ${restrictedOk ? 'text-green-400' : 'text-red-400'}`}>
          {restrictedCount}/2 Restricted slots used
          {!restrictedOk && ' — exceeds limit!'}
        </div>
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

      {/* Speed Tiers */}
      {speedTiers.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Speed Tiers</h3>
          <div className="space-y-1.5">
            {speedTiers.map(s => (
              <div key={s.name} className="flex items-center gap-2">
                <span className="text-xs text-gray-300 capitalize w-28 truncate">{s.name.replace(/-/g, ' ')}</span>
                <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pink-400 rounded-full"
                    style={{ width: `${Math.min((s.speed / 200) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400 w-8 text-right">{s.speed}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Type Weaknesses */}
      {Object.keys(weakMatrix).length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <h3 className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-3">Team Weaknesses</h3>
          <div className="flex flex-wrap gap-2">
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
                    <span className="uppercase">{type}</span>
                    <span className="opacity-80">×{count}</span>
                  </div>
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
