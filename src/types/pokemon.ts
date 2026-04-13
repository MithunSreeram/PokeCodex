export interface Stat {
  name: string;
  base: number;
}

export interface Ability {
  name: string;
  isHidden: boolean;
}

export interface Move {
  name: string;
  url: string;
}

export interface PokemonSprites {
  front_default: string | null;
  front_shiny: string | null;
  other?: {
    'official-artwork'?: {
      front_default: string | null;
      front_shiny: string | null;
    };
    home?: {
      front_default: string | null;
    };
  };
}

export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  stats: Stat[];
  abilities: Ability[];
  moves: Move[];
  sprites: PokemonSprites;
  height: number;  // in decimetres
  weight: number;  // in hectograms
  baseExperience: number;
}

export interface PokemonListItem {
  id: number;
  name: string;
  sprite: string | null;
  types: string[];
}

export type PokemonType =
  | 'normal' | 'fire' | 'water' | 'electric' | 'grass' | 'ice'
  | 'fighting' | 'poison' | 'ground' | 'flying' | 'psychic' | 'bug'
  | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';
