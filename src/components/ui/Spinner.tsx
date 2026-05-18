export function Spinner({ size = 8 }: { size?: number }) {
  const px = size * 4;
  return (
    <div style={{
      width: px,
      height: px,
      borderRadius: '50%',
      border: '2px solid var(--line-hard)',
      borderTopColor: 'var(--accent)',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}
