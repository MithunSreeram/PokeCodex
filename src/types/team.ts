import { Pokemon } from './pokemon';

export type Nature =
  | 'Hardy' | 'Lonely' | 'Brave' | 'Adamant' | 'Naughty'
  | 'Bold' | 'Docile' | 'Relaxed' | 'Impish' | 'Lax'
  | 'Timid' | 'Hasty' | 'Serious' | 'Jolly' | 'Naive'
  | 'Modest' | 'Mild' | 'Quiet' | 'Bashful' | 'Rash'
  | 'Calm' | 'Gentle' | 'Sassy' | 'Careful' | 'Quirky';

export type VGCRole =
  | 'Restricted'
  | 'Fake Out'
  | 'Tailwind Setter'
  | 'Trick Room Setter'
  | 'Redirector'
  | 'Terrain Setter'
  | 'Weather Setter'
  | 'Sweeper'
  | 'Pivot'
  | 'Support'
  | 'Wall'
  | 'Speed Control';

export interface EVSpread {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface IVSpread {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface TeamMember {
  id: string;
  pokemon: Pokemon;
  nickname: string;
  nature: Nature;
  ability: string;
  item: string;
  moves: [string, string, string, string];
  evs: EVSpread;
  ivs: IVSpread;
  role: VGCRole;
  isRestricted: boolean;
  teraType: string;
}

export interface Team {
  id: string;
  name: string;
  format: string;
  members: TeamMember[];
  createdAt: number;
  updatedAt: number;
}

export interface TeamAnalysis {
  missingRoles: VGCRole[];
  typeWeaknesses: Record<string, number>;
  typeResistances: Record<string, number>;
  speedTiers: { name: string; speed: number }[];
  leadCombinations: [string, string][];
}
