import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Team, TeamMember } from '../types/team';
import type { Pokemon } from '../types/pokemon';
import { nanoid } from '../utils/nanoid';

interface TeamStore {
  teams: Team[];
  activeTeamId: string | null;

  createTeam: (name: string, format?: string) => string;
  deleteTeam: (id: string) => void;
  setActiveTeam: (id: string) => void;
  addMember: (teamId: string, pokemon: Pokemon) => void;
  removeMember: (teamId: string, memberId: string) => void;
  updateMember: (teamId: string, memberId: string, patch: Partial<TeamMember>) => void;
  activeTeam: () => Team | null;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set, get) => ({
      teams: [],
      activeTeamId: null,

      createTeam: (name, format = 'VGC 2025 Series 2') => {
        const id = nanoid();
        const team: Team = {
          id,
          name,
          format,
          members: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set(s => ({ teams: [...s.teams, team], activeTeamId: id }));
        return id;
      },

      deleteTeam: (id) =>
        set(s => ({
          teams: s.teams.filter(t => t.id !== id),
          activeTeamId: s.activeTeamId === id ? (s.teams[0]?.id ?? null) : s.activeTeamId,
        })),

      setActiveTeam: (id) => set({ activeTeamId: id }),

      addMember: (teamId, pokemon) =>
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
              evs: { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
              ivs: { hp: 31, atk: 31, def: 31, spa: 31, spd: 31, spe: 31 },
              role: 'Sweeper',
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
              ? {
                  ...t,
                  updatedAt: Date.now(),
                  members: t.members.map(m =>
                    m.id === memberId ? { ...m, ...patch } : m
                  ),
                }
              : t
          ),
        })),

      activeTeam: () => {
        const { teams, activeTeamId } = get();
        return teams.find(t => t.id === activeTeamId) ?? null;
      },
    }),
    { name: 'pokecodex-teams' }
  )
);
