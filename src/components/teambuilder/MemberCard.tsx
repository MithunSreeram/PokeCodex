import type { TeamMember, VGCRole } from '../../store/teamStore';
import { TypeBadge } from '../ui/TypeBadge';
import { useTeamStore } from '../../store/teamStore';

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

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-gray-750 border-b border-gray-700">
        <img src={artwork ?? ''} alt={member.pokemon.name} className="w-12 h-12 object-contain" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white capitalize text-sm truncate">
            {member.pokemon.name.replace(/-/g, ' ')}
          </p>
          <div className="flex gap-1 mt-0.5">
            {member.pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
          </div>
        </div>
        <button
          onClick={() => removeMember(teamId, member.id)}
          className="text-gray-500 hover:text-red-400 text-lg leading-none px-2"
          title="Remove"
        >
          ×
        </button>
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

        {/* Restricted toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
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
