import { TYPE_COLORS, TYPE_CODES } from '../../utils/typeColors';

interface Props {
  type: string;
  size?: 'sm' | 'md';
}

export function TypeBadge({ type, size = 'md' }: Props) {
  const key = type.toLowerCase();
  const colors = TYPE_COLORS[key] ?? { bg: '#545b73', text: '#fff' };
  const code = TYPE_CODES[key] ?? type.slice(0, 2).toUpperCase();

  if (size === 'sm') {
    return (
      <span
        className="mono"
        style={{
          display: 'inline-block',
          background: colors.bg + '22',
          border: `1px solid ${colors.bg}66`,
          color: colors.bg,
          fontSize: 9,
          letterSpacing: '.06em',
          padding: '1px 5px',
        }}
      >
        {code}
      </span>
    );
  }

  return (
    <span
      className="mono"
      style={{
        display: 'inline-block',
        background: colors.bg + '28',
        border: `1px solid ${colors.bg}55`,
        color: colors.bg,
        fontSize: 10,
        letterSpacing: '.06em',
        padding: '2px 6px',
        textTransform: 'uppercase',
      }}
    >
      {code}
    </span>
  );
}
