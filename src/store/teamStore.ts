import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from '../utils/nanoid';
import type { Pokemon } from '../api/pokeapi';

// ── Inline types (no type-file imports) ──────────────────────────────────
export type Nature =
  | 'Hardy'|'Lonely'|'Brave'|'Adamant'|'Naughty'|'Bold'|'Docile'|'Relaxed'
  |'Impish'|'Lax'|'Timid'|'Hasty'|'Serious'|'Jolly'|'Naive'|'Modest'|'Mild'
  |'Quiet'|'Bashful'|'Rash'|'Calm'|'Gentle'|'Sassy'|'Careful'|'Quirky';

export type VGCRole =
  |'Restricted'|'Fake Out'|'Tailwind Setter'|'Trick Room Setter'
  |'Redirector'|'Terrain Setter'|'Weather Setter'|'Sweeper'
  |'Pivot'|'Support'|'Wall'|'Speed Control';

export interface EVSpread { hp:number; atk:number; def:number; spa:number; spd:number; spe:number }
export interface IVSpread { hp:number; atk:number; def:number; spa:number; spd:number; spe:number }

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
// ─────────────────────────────────────────────────────────────────────────

interface TeamStore {
  teams: Team[];
  activeTeamId: string | null;
  createTeam: (name: string, format?: string) => string;
  deleteTeam: (id: string) => void;
  setActiveTeam: (id: string) => void;
  addMember: (teamId: string, pokemon: Pokemon, role?: VGCRole) => void;
  removeMember: (teamId: string, memberId: string) => void;
  updateMember: (teamId: string, memberId: string, patch: Partial<TeamMember>) => void;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set) => ({
      teams: [],
      activeTeamId: null,

      createTeam: (name, format = 'VGC 2025 Series 2') => {
        const id = nanoid();
        const team: Team = { id, name, format, members: [], createdAt: Date.now(), updatedAt: Date.now() };
        set(s => ({ teams: [...s.teams, team], activeTeamId: id }));
        return id;
      },

      deleteTeam: (id) =>
        set(s => ({
          teams: s.teams.filter(t => t.id !== id),
          activeTeamId: s.activeTeamId === id ? (s.teams.find(t => t.id !== id)?.id ?? null) : s.activeTeamId,
        })),

      setActiveTeam: (id) => set({ activeTeamId: id }),

      addMember: (teamId, pokemon, role = 'Sweeper') =>
        set(s => ({
          teams: s.teams.map(t => {
            if (t.id !== teamId || t.members.length >= 6) return t;
            const member: TeamMember = {
              id: nanoid(),
              pokemon,
              nickname: '',
              nature: 'Jolly',
              ability: pokemon.abilities.find(a => !a.isHidden)?.name ?? pokemon.abilities[0]?.name ?? '',
              item: '',
              moves: ['', '', '', ''],
              evs: { hp:0, atk:0, def:0, spa:0, spd:0, spe:0 },
              ivs: { hp:31, atk:31, def:31, spa:31, spd:31, spe:31 },
              role,
              isRestricted: false,
              teraType: pokemon.types[0] ?? 'normal',
            };
            return { ...t, members: [...t.members, member], updatedAt: Date.now() };
          }),
        })),

      removeMember: (teamId, memberId) =>
        set(s => ({
          teams: s.teams.map(t =>
            t.id === teamId
              ? { ...t, members: t.members.filter(m => m.id !== memberId), updatedAt: Date.now() }
              : t
          ),
        })),

      updateMember: (teamId, memberId, patch) =>
        set(s => ({
          teams: s.teams.map(t =>
            t.id === teamId
              ? { ...t, updatedAt: Date.now(), members: t.members.map(m => m.id === memberId ? { ...m, ...patch } : m) }
              : t
          ),
        })),
    }),
    { name: 'pokecodex-teams' }
  )
);
