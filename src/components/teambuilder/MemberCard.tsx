import type { TeamMember, VGCRole } from '../../store/teamStore';
import { TypeBadge } from '../ui/TypeBadge';
import { useTeamStore } from '../../store/teamStore';
import { calcStat, getNatureEffect, STAT_ORDER, clampEV } from '../../utils/statCalc';
import { memberToShowdown } from '../../utils/showdownExport';

const VGC_ROLES: VGCRole[] = [
  'Restricted', 'Fake Out', 'Tailwind Setter', 'Trick Room Setter',
  'Redirector', 'Terrain Setter', 'Weather Setter', 'Sweeper',
  'Pivot', 'Support', 'Wall', 'Speed Control',
];

const NATURES = [
  'Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed',
  'Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild',
  'Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky',
];

interface Props {
  member: TeamMember;
  teamId: string;
}

export function MemberCard({ member, teamId }: Props) {
  const { removeMember, updateMember } = useTeamStore();
  const artwork =
    member.pokemon.sprites.other?.['official-artwork']?.front_default ??
    member.pokemon.sprites.front_default;

  function patch(p: Partial<TeamMember>) {
    updateMember(teamId, member.id, p);
  }

  const evTotal = Object.values(member.evs).reduce((a, b) => a + b, 0);
  const evRemaining = 510 - evTotal;
  const { up: natureUp, down: natureDown } = getNatureEffect(member.nature);

  function setEV(key: keyof TeamMember['evs'], raw: string) {
    const val = parseInt(raw) || 0;
    patch({ evs: clampEV(member.evs, key, val) });
  }

  function setIV(key: keyof TeamMember['ivs'], raw: string) {
    const val = Math.max(0, Math.min(31, parseInt(raw) || 0));
    patch({ ivs: { ...member.ivs, [key]: val } });
  }

  function copyShowdown() {
    navigator.clipboard.writeText(memberToShowdown(member));
  }

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-700">
        <img src={artwork ?? ''} alt={member.pokemon.name} className="w-12 h-12 object-contain" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white capitalize text-sm truncate">
            {member.pokemon.name.replace(/-/g, ' ')}
          </p>
          <div className="flex gap-1 mt-0.5">
            {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={() => removeMember(teamId, member.id)}
            className="text-gray-500 hover:text-red-400 text-lg leading-none"
            title="Remove from team"
          >×</button>
          <button
            onClick={copyShowdown}
            className="text-gray-600 hover:text-indigo-400 text-xs leading-none"
            title="Copy Showdown paste"
          >⎘</button>
        </div>
      </div>

      <div className="p-3 space-y-2 text-xs">
        {/* Nickname */}
        <input
          placeholder="Nickname"
          value={member.nickname}
          onChange={e => patch({ nickname: e.target.value })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
        />

        {/* Role */}
        <select
          value={member.role}
          onChange={e => patch({ role: e.target.value as VGCRole })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-red-500"
        >
          {VGC_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <div className="grid grid-cols-2 gap-2">
          {/* Nature */}
          <select
            value={member.nature}
            onChange={e => patch({ nature: e.target.value as TeamMember['nature'] })}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-red-500"
          >
            {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
          </select>

          {/* Ability */}
          <select
            value={member.ability}
            onChange={e => patch({ ability: e.target.value })}
            className="bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white capitalize focus:outline-none focus:border-red-500"
          >
            {member.pokemon.abilities.map(a => (
              <option key={a.name} value={a.name}>
                {a.name.replace(/-/g, ' ')}{a.isHidden ? ' (HA)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Item */}
        <input
          placeholder="Held item"
          value={member.item}
          onChange={e => patch({ item: e.target.value })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
        />

        {/* Tera Type */}
        <input
          placeholder="Tera Type"
          value={member.teraType}
          onChange={e => patch({ teraType: e.target.value })}
          className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 capitalize focus:outline-none focus:border-red-500"
        />

        {/* Moves */}
        <div className="space-y-1">
          {member.moves.map((mv, i) => (
            <input
              key={i}
              placeholder={`Move ${i + 1}`}
              value={mv}
              onChange={e => {
                const moves = [...member.moves] as [string, string, string, string];
                moves[i] = e.target.value;
                patch({ moves });
              }}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-2 py-1.5 text-white placeholder-gray-600 focus:outline-none focus:border-red-500"
            />
          ))}
        </div>

        {/* EV / IV Editor */}
        <div className="pt-1 border-t border-gray-700">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-gray-500 uppercase tracking-wider font-bold" style={{ fontSize: '10px' }}>EVs / IVs</span>
            <span
              className={`font-mono font-bold ${
                evRemaining < 0 ? 'text-red-400' : evRemaining === 0 ? 'text-green-400' : 'text-gray-500'
              }`}
              style={{ fontSize: '10px' }}
            >
              {evRemaining} EVs left
            </span>
          </div>

          <div className="grid grid-cols-3 gap-x-2 gap-y-1.5">
            {STAT_ORDER.map(({ key, apiName, label }) => {
              const base = member.pokemon.stats.find(s => s.name === apiName)?.base ?? 0;
              const calc = calcStat(base, member.evs[key], member.ivs[key], member.nature, key);
              const isUp   = natureUp   === key;
              const isDown = natureDown === key;
              const ivNonStandard = member.ivs[key] < 31;

              return (
                <div key={key} className="flex flex-col gap-0.5">
                  {/* Label row: stat abbrev + calc value */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-bold ${isUp ? 'text-red-400' : isDown ? 'text-blue-400' : 'text-gray-500'}`}
                      style={{ fontSize: '9px' }}
                    >
                      {label}
                    </span>
                    <span className="text-gray-200 font-mono" style={{ fontSize: '9px' }}>
                      {calc}
                    </span>
                  </div>

                  {/* EV input */}
                  <input
                    type="number"
                    min={0}
                    max={252}
                    step={4}
                    value={member.evs[key]}
                    onChange={e => setEV(key, e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-1 text-white text-center font-mono focus:outline-none focus:border-red-500"
                    style={{ fontSize: '11px', height: '22px' }}
                  />

                  {/* IV input — highlighted when non-standard */}
                  <input
                    type="number"
                    min={0}
                    max={31}
                    value={member.ivs[key]}
                    onChange={e => setIV(key, e.target.value)}
                    className={`w-full bg-gray-900 border rounded px-1 text-center font-mono focus:outline-none focus:border-red-500 ${
                      ivNonStandard
                        ? 'border-yellow-700 text-yellow-400'
                        : 'border-gray-700 text-gray-600'
                    }`}
                    style={{ fontSize: '10px', height: '18px' }}
                  />
                </div>
              );
            })}
          </div>

          <div className="flex justify-between mt-1" style={{ fontSize: '9px', color: '#4b5563' }}>
            <span>top row = EVs (0–252)</span>
            <span>bottom = IVs (0–31)</span>
          </div>
        </div>

        {/* Restricted toggle */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={member.isRestricted}
            onChange={e => patch({ isRestricted: e.target.checked })}
            className="accent-red-500"
          />
          <span className="text-gray-400">Restricted Legendary</span>
        </label>
      </div>
    </div>
  );
}
