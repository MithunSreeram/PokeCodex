import { Link, useLocation } from 'react-router-dom';

export function NavBar() {
  const { pathname } = useLocation();

  const links = [
    { to: '/', label: 'Pokédex' },
    { to: '/team-builder', label: 'Team Builder' },
    { to: '/battle', label: 'Battle Advisor' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-gray-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-8 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-white tracking-tight">
          <span className="text-red-500">Poke</span>Codex
        </Link>
        <div className="flex gap-1">
          {links.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === l.to
                  ? 'bg-red-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
