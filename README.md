# PokeCodex

A competitive-grade Pokédex and VGC Team Builder built for champion-level players. Browse all 9 generations, deep-dive into Pokémon stats and type matchups, and build tournament-ready VGC teams with real-time analysis.

---

## Features

- **Pokédex** — Gen 1–9 browsing, search by name or ID, type badges, stat bars, type matchup breakdown
- **VGC Team Builder** — multi-team management, role assignment, nature/ability/item/moves/tera type editor
- **Team Analysis** — missing role warnings, speed tier chart, team-wide weakness matrix
- **Showdown Export** — one-click copy to Pokémon Showdown paste format
- **Persistent teams** — teams are saved locally in your browser

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or later
- npm v9 or later

---

## Installation

```bash
# 1. Clone the repository
git clone https://github.com/mithunsreeram/pokecodex.git
cd pokecodex

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

---

## Build for Production

```bash
# Compile and bundle
npm run build

# Preview the production build locally
npm run preview
```

The output is placed in the `dist/` folder, ready to deploy to any static host (Vercel, Netlify, GitHub Pages, etc.).

---

## Usage Guide

### Pokédex

1. Open the app — the Pokédex loads Gen 1 by default.
2. Click a **Gen** button (Gen 1 – Gen 9) to switch generations.
3. Type in the **search bar** to filter by name or Pokédex number.
4. Click any **Pokémon card** to open the detail panel:
   - View base stats, abilities, height/weight, and BST.
   - See the full **type matchup table** — weaknesses and resistances with exact multipliers.
   - Click **"Add to Team"** to drop the Pokémon directly into your active team.

### VGC Team Builder

1. Navigate to **Team Builder** in the top nav.
2. Enter a team name and click **+** to create a new team.
3. Type a Pokémon name in the **Add Pokémon** field (e.g. `incineroar`, `flutter-mane`) and press Enter.
4. Each team slot shows a member card — fill in:
   - **Nickname** (optional)
   - **VGC Role** — Fake Out, Tailwind Setter, Trick Room Setter, Redirector, etc.
   - **Nature** and **Ability** (dropdown populated from the Pokémon's actual abilities)
   - **Held Item** and **Tera Type**
   - **4 Moves** (free text — autocomplete coming soon)
   - **Restricted Legendary** checkbox if applicable
5. The **Team Analysis** panel on the right updates live:
   - Flags missing core roles (Fake Out, Tailwind, etc.)
   - Shows a **Speed Tier** bar for all 6 members
   - Shows which types hit 2+ members (team weakness matrix)
   - Warns if you exceed the 2-restricted-legendary limit
6. Click **Copy Showdown Export** to copy the full team to your clipboard, ready to paste into Pokémon Showdown.

### Multiple Teams

- Create as many teams as you like from the sidebar.
- Click a team name to make it active.
- Teams are automatically saved in your browser — they persist across page refreshes.
- Click **×** next to a team name to delete it.

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| State management | Zustand (with localStorage persistence) |
| Routing | React Router v7 |
| Data | PokeAPI (pokeapi.co) |
| HTTP client | Axios |

---

## Project Structure

```
src/
├── api/            PokeAPI client with in-memory caching
├── components/
│   ├── pokedex/    PokemonCard, PokemonDetail
│   ├── teambuilder/ MemberCard, TeamAnalysisPanel
│   └── ui/         NavBar, TypeBadge, StatBar, Spinner
├── pages/          PokedexPage, TeamBuilderPage
├── store/          Zustand team store
├── types/          Pokemon and Team TypeScript types
└── utils/          Type chart, type colors, Showdown export, nanoid
```
