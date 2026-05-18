import { Link, useLocation } from 'react-router-dom';

function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" style={{ display: 'block' }}>
      <path d="M4 4 L4 28 L8 28 L8 18 L20 18 L20 14 L8 14 L8 8 L24 8 L24 4 Z" fill="var(--accent)" />
      <path d="M28 12 L28 28 L24 28 L24 22 L18 22 L18 28 L14 28 L14 18 L28 18 Z" fill="#fff" opacity={0.92} />
      <circle cx="29" cy="5" r="2" fill="var(--accent)" />
    </svg>
  );
}

export function NavBar() {
  const { pathname } = useLocation();

  const links = [
    { to: '/', label: 'Pokédex' },
    { to: '/team-builder', label: 'Team Builder' },
    { to: '/battle', label: 'Battle Advisor', hot: true },
  ];

  return (
    <nav className="nav">
      <div className="wrap-wide" style={{ display: 'flex', alignItems: 'center', height: 48, gap: 24 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <LogoMark size={22} />
          <div style={{ display: 'flex', alignItems: 'baseline' }}>
            <span className="hud-title" style={{ color: 'var(--accent)', fontSize: 18 }}>POKE</span>
            <span className="hud-title" style={{ color: '#fff', fontSize: 18 }}>CODEX</span>
          </div>
          <span className="mono" style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 4, letterSpacing: '.08em' }}>
            v2.6 · GEN 9
          </span>
        </Link>

        {/* Divider */}
        <div style={{ width: 1, height: 22, background: 'var(--line)', flexShrink: 0 }} />

        {/* Nav links */}
        <div style={{ display: 'flex', gap: 4 }}>
          {links.map(link => {
            const active = pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className="clip-tab"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px 6px 14px',
                  fontFamily: 'Chakra Petch',
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  background: active ? 'var(--accent)' : 'transparent',
                  color: active ? '#0a0b0e' : 'var(--text-2)',
                  transition: 'all .12s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-0)'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}
              >
                {link.label}
                {link.hot && !active && (
                  <span style={{
                    width: 5, height: 5,
                    background: 'var(--accent)',
                    flexShrink: 0,
                    boxShadow: '0 0 6px var(--accent-glow)',
                    display: 'inline-block',
                  }} />
                )}
              </Link>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Right side info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="hud-label">FORMAT</span>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-1)' }}>VGC 2025 REG H</span>
          <span style={{ width: 1, height: 16, background: 'var(--line)' }} />
          <span className="hud-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="pulse-tick" style={{ width: 6, height: 6, background: 'var(--green)', display: 'inline-block' }} />
            LIVE
          </span>
        </div>
      </div>
    </nav>
  );
}
