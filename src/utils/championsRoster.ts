/**
 * Pokémon Champions — Regular Roster M-A (active until June 16, 2026)
 * 187 species. Names match PokeAPI slugs exactly.
 * Source: bulbapedia.bulbagarden.net/wiki/List_of_Pokémon_in_Pokémon_Champions
 */
export const CHAMPIONS_ROSTER = new Set<string>([
  // Gen 1
  'venusaur', 'charizard', 'blastoise', 'beedrill', 'pidgeot',
  'arbok', 'pikachu', 'raichu', 'raichu-alola',
  'clefable', 'ninetales', 'ninetales-alola',
  'arcanine', 'arcanine-hisui',
  'alakazam', 'machamp', 'victreebel',
  'slowbro', 'slowbro-galar',
  'gengar', 'kangaskhan', 'starmie', 'pinsir',
  'tauros', 'tauros-paldea-combat', 'tauros-paldea-blaze', 'tauros-paldea-aqua',
  'gyarados', 'ditto', 'vaporeon', 'jolteon', 'flareon',
  'aerodactyl', 'snorlax', 'dragonite',

  // Gen 2
  'meganium',
  'typhlosion', 'typhlosion-hisui',
  'feraligatr', 'ariados', 'ampharos', 'azumarill', 'politoed',
  'espeon', 'umbreon',
  'slowking', 'slowking-galar',
  'forretress', 'steelix', 'scizor', 'heracross',
  'skarmory', 'houndoom', 'tyranitar',

  // Gen 3
  'pelipper', 'gardevoir', 'sableye', 'aggron', 'medicham',
  'manectric', 'sharpedo', 'camerupt', 'torkoal', 'altaria',
  'milotic', 'castform', 'banette', 'chimecho', 'absol', 'glalie',

  // Gen 4
  'torterra', 'infernape', 'empoleon', 'luxray', 'roserade',
  'rampardos', 'bastiodon', 'lopunny', 'spiritomb', 'garchomp',
  'lucario', 'hippowdon', 'toxicroak', 'abomasnow', 'weavile',
  'rhyperior', 'leafeon', 'glaceon', 'gliscor', 'mamoswine',
  'gallade', 'froslass',
  'rotom', 'rotom-heat', 'rotom-wash', 'rotom-frost', 'rotom-fan', 'rotom-mow',

  // Gen 5
  'serperior', 'emboar',
  'samurott', 'samurott-hisui',
  'watchog', 'liepard', 'simisage', 'simisear', 'simipour',
  'excadrill', 'audino', 'conkeldurr', 'whimsicott', 'krookodile',
  'cofagrigus', 'garbodor',
  'zoroark', 'zoroark-hisui',
  'reuniclus', 'vanilluxe', 'emolga', 'chandelure', 'beartic',
  'stunfisk', 'stunfisk-galar',
  'golurk', 'hydreigon', 'volcarona',

  // Gen 6
  'chesnaught', 'delphox', 'greninja', 'diggersby', 'talonflame',
  'vivillon', 'floette-eternal',
  'florges', 'pangoro', 'furfrou',
  'meowstic', 'meowstic-f',
  'aegislash', 'aromatisse', 'slurpuff', 'clawitzer', 'heliolisk',
  'tyrantrum', 'aurorus', 'sylveon', 'hawlucha', 'dedenne',
  'goodra', 'goodra-hisui',
  'klefki', 'trevenant',
  'gourgeist', 'gourgeist-small', 'gourgeist-large', 'gourgeist-super',
  'avalugg', 'avalugg-hisui',
  'noivern',

  // Gen 7
  'decidueye', 'decidueye-hisui',
  'incineroar', 'primarina', 'toucannon', 'crabominable',
  'lycanroc', 'lycanroc-midnight', 'lycanroc-dusk',
  'toxapex', 'mudsdale', 'araquanid', 'salazzle', 'tsareena',
  'oranguru', 'passimian', 'mimikyu', 'drampa', 'kommo-o',

  // Gen 8
  'corviknight', 'flapple', 'appletun', 'sandaconda', 'polteageist',
  'hatterene', 'mr-rime', 'runerigus', 'alcremie', 'morpeko', 'dragapult',

  // Hisui / Legends: Arceus additions
  'wyrdeer', 'kleavor',
  'basculegion', 'basculegion-f',
  'sneasler',

  // Gen 9 (Paldea)
  'meowscarada', 'skeledirge', 'quaquaval', 'maushold', 'garganacl',
  'armarouge', 'ceruledge', 'bellibolt', 'scovillain', 'espathra',
  'tinkaton', 'palafin', 'orthworm', 'glimmora', 'farigiraf',
  'kingambit', 'sinistcha', 'archaludon', 'hydrapple',
]);

export function isChampionsEligible(pokemonName: string): boolean {
  return CHAMPIONS_ROSTER.has(pokemonName.toLowerCase());
}
