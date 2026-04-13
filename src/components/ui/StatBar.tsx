import { STAT_COLORS, STAT_LABELS } from '../../utils/typeColors';

interface Props {
  name: string;
  value: number;
  max?: number;
}

export function StatBar({ name, value, max = 255 }: Props) {
  const pct = Math.round((value / max) * 100);
  const color = STAT_COLORS[name] ?? '#aaa';
  const label = STAT_LABELS[name] ?? name;

  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-right text-xs font-bold text-gray-400 uppercase">{label}</span>
      <span className="w-8 text-right text-sm font-semibold text-gray-200">{value}</span>
      <div className="flex-1 h-2.5 rounded-full bg-gray-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}
