export const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  normal:   { bg: '#B8B8B0', text: '#0a0b0e' },
  fire:     { bg: '#FF6B35', text: '#0a0b0e' },
  water:    { bg: '#4D9DE0', text: '#0a0b0e' },
  electric: { bg: '#FFCB2D', text: '#0a0b0e' },
  grass:    { bg: '#5FCC4F', text: '#0a0b0e' },
  ice:      { bg: '#8FDAE5', text: '#0a0b0e' },
  fighting: { bg: '#E03E3E', text: '#fff' },
  poison:   { bg: '#B557D6', text: '#fff' },
  ground:   { bg: '#DBA760', text: '#0a0b0e' },
  flying:   { bg: '#A6B5EE', text: '#0a0b0e' },
  psychic:  { bg: '#FF5C9C', text: '#fff' },
  bug:      { bg: '#B5C835', text: '#0a0b0e' },
  rock:     { bg: '#B8A050', text: '#0a0b0e' },
  ghost:    { bg: '#7A5BB8', text: '#fff' },
  dragon:   { bg: '#7060F5', text: '#fff' },
  dark:     { bg: '#7A7A82', text: '#fff' },
  steel:    { bg: '#A8B6C2', text: '#0a0b0e' },
  fairy:    { bg: '#F0A8DE', text: '#0a0b0e' },
};

export const TYPE_CODES: Record<string, string> = {
  normal: 'NR', fire: 'FI', water: 'WA', electric: 'EL', grass: 'GR', ice: 'IC',
  fighting: 'FT', poison: 'PO', ground: 'GD', flying: 'FL', psychic: 'PS', bug: 'BG',
  rock: 'RK', ghost: 'GH', dragon: 'DR', dark: 'DK', steel: 'ST', fairy: 'FA',
};

export const STAT_COLORS: Record<string, string> = {
  hp:               '#FF5959',
  attack:           '#F5AC78',
  defense:          '#FAE078',
  'special-attack':  '#9DB7F5',
  'special-defense': '#A7DB8D',
  speed:            '#FA92B2',
};

export const STAT_LABELS: Record<string, string> = {
  hp:               'HP',
  attack:           'Atk',
  defense:          'Def',
  'special-attack':  'SpA',
  'special-defense': 'SpD',
  speed:            'Spe',
};
