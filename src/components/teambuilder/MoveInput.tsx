import { useState, useRef, useEffect } from 'react';
import type { Move } from '../../api/pokeapi';

export function formatMoveName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface Props {
  value: string;
  onChange: (slug: string) => void;
  legalMoves: Move[];
  placeholder: string;
}

export function MoveInput({ value, onChange, legalMoves, placeholder }: Props) {
  const [query, setQuery] = useState(value ? formatMoveName(value) : '');
  const [open, setOpen]   = useState(false);
  const containerRef      = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value ? formatMoveName(value) : ''); }, [value]);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const normalised = query.toLowerCase().replace(/\s+/g, '-');
  const suggestions = query.length >= 2
    ? legalMoves
        .filter(m => m.name.includes(normalised) || formatMoveName(m.name).toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10)
    : [];

  const isIllegal = value !== '' && !legalMoves.some(m => m.name === value);

  function selectMove(slug: string) {
    onChange(slug);
    setQuery(formatMoveName(slug));
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value);
    setOpen(true);
    if (!e.target.value) onChange('');
  }

  function handleBlur() {
    const exact = legalMoves.find(m => formatMoveName(m.name).toLowerCase() === query.toLowerCase());
    if (exact) { onChange(exact.name); setQuery(formatMoveName(exact.name)); }
    setTimeout(() => setOpen(false), 120);
  }

  const ipt: React.CSSProperties = {
    appearance: 'none',
    width: '100%',
    border: `1px solid ${isIllegal ? 'var(--accent)' : value ? 'rgba(43,255,142,.4)' : 'var(--line-hard)'}`,
    background: 'var(--bg-0)',
    color: 'var(--text-0)',
    padding: '4px 24px 4px 8px',
    fontFamily: 'Chakra Petch',
    fontSize: 10,
    outline: 'none',
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={handleBlur}
        style={ipt}
      />
      {isIllegal && (
        <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--accent)', fontWeight: 700 }}>✗</span>
      )}
      {value && !isIllegal && (
        <span style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--green)' }}>✓</span>
      )}
      {open && suggestions.length > 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 1, background: 'var(--bg-2)', border: '1px solid var(--line-hard)', boxShadow: '0 8px 24px rgba(0,0,0,.4)' }}>
          {suggestions.map(m => (
            <button
              key={m.name}
              type="button"
              onMouseDown={() => selectMove(m.name)}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', background: 'transparent', border: 0, borderBottom: '1px solid var(--line)', color: 'var(--text-1)', fontSize: 10, fontFamily: 'Chakra Petch', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {formatMoveName(m.name)}
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && suggestions.length === 0 && (
        <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 1, background: 'var(--bg-2)', border: '1px solid var(--accent)', padding: '6px 10px', fontSize: 10, color: 'var(--accent)' }}>
          Not in pool — can&apos;t learn this move
        </div>
      )}
    </div>
  );
}
