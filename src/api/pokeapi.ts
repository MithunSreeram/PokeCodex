import axios from 'axios';

const BASE = 'https://pokeapi.co/api/v2';
const client = axios.create({ baseURL: BASE, timeout: 10000 });
const cache = new Map<string, unknown>();

async function get<T>(path: string): Promise<T> {
  if (cache.has(path)) return cache.get(path) as T;
  const { data } = await client.get<T>(path);
  cache.set(path, data);
  return data;
}

// ── Inline types (no cross-file imports) ──────────────────────────────────
export interface Stat { name: string; base: number }
export interface Ability { name: string; isHidden: boolean }
export interface Move { name: string; url: string }
export interface PokemonSprites {
  front_default: string | null;
  front_shiny: string | null;
  other?: {
    'official-artwork'?: { front_default: string | null; front_shiny: string | null };
    home?: { front_default: string | null };
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
  height: number;
  weight: number;
  baseExperience: number;
}
export interface PokemonListItem {
  id: number;
  name: string;
  sprite: string | null;
  types: string[];
}
// ─────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePokemon(raw: any): Pokemon {
  return {
    id: raw.id,
    name: raw.name,
    types: raw.types.map((t: any) => t.type.name as string),
    stats: raw.stats.map((s: any) => ({ name: s.stat.name, base: s.base_stat })),
    abilities: raw.abilities.map((a: any) => ({ name: a.ability.name, isHidden: a.is_hidden })),
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
  return Promise.all(
    data.results.map(async (r: any) => {
      const segments = r.url.replace(/\/$/, '').split('/');
      const id = parseInt(segments[segments.length - 1], 10);
      const sprite = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      const detail = await get<any>(`/pokemon/${id}`);
      return { id, name: r.name, sprite, types: detail.types.map((t: any) => t.type.name as string) };
    })
  );
}

export async function searchPokemon(query: string): Promise<Pokemon | null> {
  try { return await fetchPokemon(query.toLowerCase().trim()); }
  catch { return null; }
}

export async function fetchAbilityEffect(name: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = await get<any>(`/ability/${name}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const en = (raw.effect_entries as any[]).find((e: any) => e.language.name === 'en');
  return en?.short_effect ?? en?.effect ?? '';
}

export async function fetchAllPokemonNames(): Promise<string[]> {
  const data = await get<any>('/pokemon?limit=1500&offset=0');
  return (data.results as any[]).map((r: any) => r.name as string);
}

export async function fetchGeneration(gen: number): Promise<PokemonListItem[]> {
  const ranges: Record<number, [number, number]> = {
    1:[1,151],2:[152,251],3:[252,386],4:[387,493],
    5:[494,649],6:[650,721],7:[722,809],8:[810,905],9:[906,1025],
  };
  const [start, end] = ranges[gen] ?? [1, 151];
  return fetchPokemonList(end - start + 1, start - 1);
}
