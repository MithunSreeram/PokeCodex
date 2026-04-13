import axios from 'axios';
import type { Pokemon, PokemonListItem } from '../types/pokemon';

const BASE = 'https://pokeapi.co/api/v2';

const client = axios.create({ baseURL: BASE, timeout: 10000 });

// Simple in-memory cache
const cache = new Map<string, unknown>();

async function get<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const { data } = await client.get<T>(path);
  cache.set(path, data);
  return data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePokemon(raw: any): Pokemon {
  return {
    id: raw.id,
    name: raw.name,
    types: raw.types.map((t: any) => t.type.name as string),
    stats: raw.stats.map((s: any) => ({ name: s.stat.name, base: s.base_stat })),
    abilities: raw.abilities.map((a: any) => ({
      name: a.ability.name,
      isHidden: a.is_hidden,
    })),
    moves: raw.moves.map((m: any) => ({ name: m.move.name, url: m.move.url })),
    sprites: raw.sprites,
    height: raw.height,
    weight: raw.weight,
    baseExperience: raw.base_experience,
  };
}

export async function fetchPokemon(nameOrId: string | number): Promise<Pokemon> {
  const raw = await get<any>(`/pokemon/${nameOrId}`);
  return parsePokemon(raw);
}

export async function fetchPokemonList(limit = 151, offset = 0): Promise<PokemonListItem[]> {
  const data = await get<any>(`/pokemon?limit=${limit}&offset=${offset}`);
  const results: PokemonListItem[] = await Promise.all(
    data.results.map(async (r: any) => {
      const segments = r.url.replace(/\/$/, '').split('/');
      const id = parseInt(segments[segments.length - 1], 10);
      const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      // Fetch types for each pokemon — batched via cache
      const detail = await get<any>(`/pokemon/${id}`);
      return {
        id,
        name: r.name,
        sprite,
        types: detail.types.map((t: any) => t.type.name as string),
      };
    })
  );
  return results;
}

export async function searchPokemon(query: string): Promise<Pokemon | null> {
  try {
    return await fetchPokemon(query.toLowerCase().trim());
  } catch {
    return null;
  }
}

export async function fetchGeneration(gen: number): Promise<PokemonListItem[]> {
  const genRanges: Record<number, [number, number]> = {
    1: [1, 151],
    2: [152, 251],
    3: [252, 386],
    4: [387, 493],
    5: [494, 649],
    6: [650, 721],
    7: [722, 809],
    8: [810, 905],
    9: [906, 1025],
  };
  const [start, end] = genRanges[gen] ?? [1, 151];
  return fetchPokemonList(end - start + 1, start - 1);
}
