import type { PokemonListItem } from '../../api/pokeapi';
import { TypeBadge } from '../ui/TypeBadge';
import { TYPE_COLORS } from '../../utils/typeColors';

interface Props {
  pokemon: PokemonListItem;
  onClick: () => void;
}

export function PokemonCard({ pokemon, onClick }: Props) {
  const key0 = pokemon.types[0].toLowerCase();
  const key1 = pokemon.types[1]?.toLowerCase() ?? key0;
  const c1 = TYPE_COLORS[key0]?.bg ?? '#545b73';
  const c2 = TYPE_COLORS[key1]?.bg ?? c1;

  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        border: '1px solid var(--line)',
        background: 'var(--bg-1)',
        padding: 0,
        cursor: 'pointer',
        textAlign: 'left',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        transition: 'border-color .12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line-hard)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--line)'; }}
    >
      {/* Sprite area */}
      <div style={{
        position: 'relative',
        aspectRatio: '1 / 1',
        overflow: 'hidden',
        background: `radial-gradient(120% 120% at 30% 20%, ${c1}28, transparent 60%), radial-gradient(120% 120% at 80% 90%, ${c2}1a, transparent 60%), var(--bg-2)`,
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(to right, rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.04) 1px, transparent 1px)',
          backgroundSize: '12px 12px',
        }} />

        {/* ID */}
        <span className="mono" style={{ position: 'absolute', top: 5, left: 7, fontSize: 9, color: 'var(--text-3)', letterSpacing: '.04em' }}>
          #{String(pokemon.id).padStart(4, '0')}
        </span>

        {/* Sprite */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {pokemon.sprite ? (
            <img
              src={pokemon.sprite}
              alt={pokemon.name}
              loading="lazy"
              style={{ width: '80%', height: '80%', objectFit: 'contain' }}
            />
          ) : (
            <span style={{ color: 'var(--text-3)', fontSize: 28 }}>?</span>
          )}
        </div>

        {/* Bottom type gradient line */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 1, background: `linear-gradient(to right, transparent, ${c1}aa, transparent)` }} />
      </div>

      {/* Name + types */}
      <div style={{ padding: '7px 9px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <span className="hud-title" style={{ fontSize: 12, color: 'var(--text-0)', textTransform: 'capitalize' }}>
          {pokemon.name.replace(/-/g, ' ')}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {pokemon.types.map(t => <TypeBadge key={t} type={t} size="sm" />)}
        </div>
      </div>
    </button>
  );
}
