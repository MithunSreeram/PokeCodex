import { useState, useRef, useEffect } from 'react';
import type { Move } from '../../api/pokeapi';

export function formatMoveName(name: string): string {
  return name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface Props {
  value: string;          // stored as PokeAPI slug (e.g. "flamethrower")
  onChange: (slug: string) => void;
  legalMoves: Move[];
  placeholder: string;
}

export function MoveInput({ value, onChange, legalMoves, placeholder }: Props) {
  const [query, setQuery]   = useState(value ? formatMoveName(value) : '');
  const [open, setOpen]     = useState(false);
  const containerRef        = useRef<HTMLDivElement>(null);

  // Keep display text in sync when value changes externally
  useEffect(() => {
    setQuery(value ? formatMoveName(value) : '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const normalised = query.toLowerCase().replace(/\s+/g, '-');
  const suggestions = query.length >= 2
    ? legalMoves
        .filter(m =>
          m.name.includes(normalised) ||
          formatMoveName(m.name).toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, 10)
    : [];

  // Red border if something is typed but it doesn't match any legal move
  const isIllegal = value !== '' && !legalMoves.some(m => m.name === value);

  function selectMove(slug: string) {
    onChange(slug);
    setQuery(formatMoveName(slug));
    setOpen(false);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setQuery(text);
    setOpen(true);
    // Clear stored value if user erases input
    if (!text) onChange('');
  }

  function handleBlur() {
    // If nothing selected but text matches exactly, auto-commit
    const exact = legalMoves.find(
      m => formatMoveName(m.name).toLowerCase() === query.toLowerCase(),
    );
    if (exact) {
      onChange(exact.name);
      setQuery(formatMoveName(exact.name));
    }
    // Close after a tick so mousedown on option fires first
    setTimeout(() => setOpen(false), 120);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        onChange={handleChange}
        onFocus={() => query.length >= 2 && setOpen(true)}
        onBlur={handleBlur}
        className={`w-full bg-gray-900 border rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none pr-6 ${
          isIllegal
            ? 'border-red-500 focus:border-red-400'
            : value
              ? 'border-green-800 focus:border-green-600'
              : 'border-gray-700 focus:border-red-500'
        }`}
      />

      {/* Status icon */}
      {isIllegal && (
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 text-xs font-bold"
          title="Not in this Pokémon's move pool"
        >✗</span>
      )}
      {value && !isIllegal && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-xs">✓</span>
      )}

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-gray-800 border border-gray-600 rounded-xl shadow-2xl overflow-hidden">
          {suggestions.map(m => (
            <button
              key={m.name}
              type="button"
              onMouseDown={() => selectMove(m.name)}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-700 transition-colors"
            >
              {formatMoveName(m.name)}
            </button>
          ))}
        </div>
      )}

      {/* "No results" hint */}
      {open && query.length >= 2 && suggestions.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-gray-800 border border-red-700/50 rounded-xl px-3 py-2 text-xs text-red-400">
          Not in {placeholder.replace('Move ', '')} — can't learn this move
        </div>
      )}
    </div>
  );
}
