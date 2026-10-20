// Plant Tycoon species model.
// Both lists were extracted from string literals inside "Plant Tycoon.exe"
// (the exe stores them in reverse order). Index 0 in these arrays is tier 1.

export const FOLIAGE = [
  'Reptans', 'Scandens', 'Grass', 'Orchid', 'Astera', 'Gladiatus', 'Fern',
  'Ananas', 'Maranta', 'Fanleaf', 'Lemonbush', 'Bamboo', 'Maple', 'Rare Oak',
  'Pipe Cactus', 'Pear Cactus', 'Ball Cactus', 'Glaber', 'Tigerfern',
  'Pitcher', 'Weeper', 'Multiflora', 'Ridgeball',
];

export const FLOWERS = [
  'Spotted', 'Painted', 'Daisy', 'Nox', 'Bluestar', 'Mystic', 'Rosaceae',
  'Viola', 'Jalapa', 'Fabled', 'Fragrant', 'Blazing', 'Fourpetal', 'Aureus',
  'Venomous', 'Mela', 'Citrus', 'Arthurium', 'Venus', 'Tahitian', 'Lilia',
  'Baccatus', 'Tilia',
];

export const TIERS = 23;

/** A species is { f, w } where f = foliage tier 1..23, w = flower tier 1..23. */
export const species = (f, w) => ({ f, w });

/** In-game naming is "<Flower> <Foliage>", e.g. tier f=1,w=17 -> "Citrus Reptans". */
export function speciesName({ f, w }) {
  return `${FLOWERS[w - 1]} ${FOLIAGE[f - 1]}`;
}

export const speciesKey = ({ f, w }) => f * 100 + w;
export const keyToSpecies = (k) => ({ f: Math.floor(k / 100), w: k % 100 });

/**
 * "<Flower> <Foliage>" back to { f, w }, matching whole words: a suffix match
 * read every "... Tigerfern" as "Fern". Case and extra spaces do not matter.
 */
export function parseSpeciesName(name) {
  const words = String(name).trim().toLowerCase().split(/\s+/);
  const w = FLOWERS.findIndex((x) => x.toLowerCase() === words[0]);
  const rest = words.slice(1).join(' ');
  const f = FOLIAGE.findIndex((x) => x.toLowerCase() === rest);
  if (w === -1 || f === -1) return null;
  return { f: f + 1, w: w + 1 };
}

/**
 * The wiki's four tiers, derived from list position rather than looked up.
 * Tier 1 is every fourth species from the first (1, 5, 9, 13, 17); tier 2 the
 * midpoints between them (3, 7, 11, 15); tier 3 all the evens below 18; tier
 * 4 the top six (18..23). Both axes follow the same pattern, which is why
 * the wiki's "tier 4 only breeds from tier 4" holds: the average of two
 * ranks must reach 18. Higher tiers need better soil and more care.
 */
export function tier(rank) {
  if (rank >= 18) return 4;
  if (rank % 2 === 0) return 3;
  return rank % 4 === 3 ? 2 : 1;
}

/** Tier of a species, as the wiki reports it: max of the two axes. */
export const speciesTier = ({ f, w }) => Math.max(tier(f), tier(w));

/**
 * The six Magic Plants - the game's actual goal. Species, in-game name and
 * effect from the wiki (planttycoon.fandom.com/wiki/Magic_Plants); the game
 * repots a discovered one in a golden pot in the nursery. None is tier 4, so
 * every one can be bred from ordinary stock.
 */
export const MAGIC_PLANTS = [
  { f: 13, w: 13, name: 'Magic Tree of Fragrance', effect: 'more visitors and rarer insects' },
  { f: 7,  w: 7,  name: 'Rose of Joy',             effect: 'a steady crowd of visitors' },
  { f: 2,  w: 14, name: 'Golden Berries of Wealth', effect: 'customers pay more, for everything' },
  { f: 11, w: 10, name: 'Fabled Rose of Isola',    effect: 'sells for the most of any plant' },
  { f: 14, w: 16, name: 'Fruit of Life',           effect: 'plants resist infestation and flower more' },
  { f: 4,  w: 4,  name: 'Flower of Knowledge',     effect: 'every plant priced near its true value' },
];

/** The magic plant a species is, if it is one. */
export const magicOf = ({ f, w }) => MAGIC_PLANTS.find((m) => m.f === f && m.w === w) || null;

/**
 * What a tier needs to stay healthy, per the wiki's Plants page: tiers 1-2
 * manage on Common Soil and Tap Water (tier 2 with more attention), tier 3
 * needs Bio-organic Soil and Filtered Water, tier 4 Soil and Water from
 * Isola. Shop prices from the Tools page.
 */
/** The shop's grades, by number, and what each costs. */
export const SOIL_GRADES = ['Common Soil', 'Bio-organic Soil', 'Soil from Isola'];
export const WATER_GRADES = ['Tap Water', 'Filtered Water', 'Water from Isola'];
export const SOIL_PRICE = [0, 850, 3000];
export const WATER_PRICE = [0, 650, 2700];
/** The soil and water grade a tier needs, per the wiki. */
export const NEEDS = { 1: 1, 2: 1, 3: 2, 4: 3 };

export const CARE = {
  1: { soil: 'Common Soil', water: 'Tap Water', need: 'the basic soil and water' },
  2: { soil: 'Common Soil', water: 'Tap Water', need: 'the basic soil and water, with attention' },
  3: { soil: 'Bio-organic Soil', water: 'Filtered Water', need: 'Bio-organic Soil ($850) and Filtered Water ($650)' },
  4: { soil: 'Soil from Isola', water: 'Water from Isola', need: 'Soil and Water from Isola ($3,000 + $2,700)' },
};

/** What a spare seed fetches in the trash can, by its tier. */
export const SEED_SALE = { 1: 1, 2: 3, 3: 5, 4: 10 };
