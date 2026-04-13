import { TYPE_COLORS } from '../../utils/typeColors';

interface Props {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'md' }: Props) {
  const colors = TYPE_COLORS[type] ?? { bg: '#888', text: '#fff' };
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-block rounded-full font-semibold uppercase tracking-wide ${sizeClass}`}
      style={{ background: colors.bg, color: colors.text }}
    >
      {type}
    </span>
  );
}
