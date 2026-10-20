import {
  MAGIC_PLANTS, speciesKey, speciesName, speciesTier, tier, FOLIAGE, FLOWERS,
  NEEDS, SOIL_GRADES, WATER_GRADES, SOIL_PRICE, WATER_PRICE,
} from './species.js';
import { findPath, floors, ceilings } from './breed.js';

/**
 * The road to a Magic Plant, derived from the live save every time. Nothing
 * here is remembered: a step is "done" because the save shows its result,
 * never because it was done earlier.
 */

/** The shop's seed lottery, by the tier it can yield. Wiki mapping. */
export const SEED_PACKETS = [
  { name: 'Common Seeds', price: 50, tiers: [1, 2] },
  { name: 'Endangered Seeds', price: 200, tiers: [3] },
  { name: 'Extinct Seeds', price: 2000, tiers: [4] },
];

export function packetFor(rank) {
  const t = tier(rank);
  return SEED_PACKETS.find((p) => p.tiers.includes(t)) || SEED_PACKETS[0];
}

/** Distinct species the player can breed from: growing, or held as seed. */
export function stockOf(save) {
  const seen = new Map();
  for (const p of save.pots) if (p.planted && p.species) seen.set(speciesKey(p.species), p.species);
  for (const s of save.seeds || []) if (s.species) seen.set(speciesKey(s.species), s.species);
  return [...seen.values()];
}

const has = (save, species) => stockOf(save).some((s) => speciesKey(s) === speciesKey(species));

/** A mature, unused pot of this species, if any. */
const fertilePot = (save, species) =>
  save.pots.find((p) => p.planted && p.canPollinate && p.species && speciesKey(p.species) === speciesKey(species));

/**
 * Rate one Magic Plant from the current state: what must be bought, how
 * many crosses, how many waits, and so how far away it is.
 */
export function rateGoal(save, magic) {
  const stock = stockOf(save);
  const found = has(save, magic);
  const purchases = [];
  const why = [];

  if (!found && stock.length) {
    // Stock band: averaging never leaves [lowest, highest] on either axis.
    const lo = floors(stock);
    const hi = ceilings(stock);
    const need = (axis, rank, dir) => {
      const names = axis === 'f' ? FOLIAGE : FLOWERS;
      const what = axis === 'f' ? 'leaves' : 'flowers';
      const packet = packetFor(rank);
      purchases.push({
        kind: 'buy', item: packet.name, cost: packet.price,
        text: `Buy ${packet.name} ($${packet.price}) until you get ${names[rank - 1]}-or-${dir} ${what}`,
      });
      why.push(`needs ${names[rank - 1]}-or-${dir} ${what}`);
    };
    if (magic.f < lo.f) need('f', magic.f, 'lower');
    if (magic.f > hi.f) need('f', magic.f, 'higher');
    if (magic.w < lo.w) need('w', magic.w, 'lower');
    if (magic.w > hi.w) need('w', magic.w, 'higher');
  }
  const lottery = purchases.length > 0;

  // Care: the goal's tier needs a soil and water grade.
  const shop = save.shop || { soil: 1, water: 1 };
  const grade = NEEDS[speciesTier(magic)] || 1;
  if (!found && shop.soil < grade) {
    purchases.push({ kind: 'buy', item: SOIL_GRADES[grade - 1], cost: SOIL_PRICE[grade - 1],
      text: `Buy ${SOIL_GRADES[grade - 1]} ($${SOIL_PRICE[grade - 1].toLocaleString('en-US')})` });
  }
  if (!found && shop.water < grade) {
    purchases.push({ kind: 'buy', item: WATER_GRADES[grade - 1], cost: WATER_PRICE[grade - 1],
      text: `Buy ${WATER_GRADES[grade - 1]} ($${WATER_PRICE[grade - 1].toLocaleString('en-US')})` });
  }

  // Crosses, when the stock can reach it at all.
  let crosses = [];
  if (!found && !lottery && stock.length) {
    const path = findPath(stock, magic, { maxDepth: 5 });
    if (path === null) why.push('no cross from your plants reaches it');
    else crosses = path;
  }

  // Waits: a parent of the first cross that is not a fertile pot right now
  // must be planted or grown first; every later cross needs its child grown.
  let waits = 0;
  if (crosses.length) {
    for (const parent of [crosses[0].a, crosses[0].b]) if (!fertilePot(save, parent)) waits++;
    waits += crosses.length - 1;
  }

  const reachable = !found && !lottery && (crosses.length > 0 || has(save, magic));
  const distance = purchases.length + crosses.length + waits;
  if (!why.length && !found) why.push(`${crosses.length} cross${crosses.length === 1 ? '' : 'es'}, ${waits} wait${waits === 1 ? '' : 's'}`);
  return { magic, found, purchases, crosses, waits, distance, reachable, why: why.join('; ') };
}

/**
 * The player's pick if it is still unfound, else the closest unfound goal.
 * A goal with a concrete road beats one that hangs on the seed lottery: a
 * lottery "distance" only counts packets, not the unknown number of tries.
 */
export function chooseGoal(goals, pick) {
  const open = goals.filter((g) => !g.found);
  if (!open.length) return null;
  if (pick) {
    const p = open.find((g) => g.magic.f === pick.f && g.magic.w === pick.w);
    if (p) return p;
  }
  return open.slice().sort((a, b) =>
    (b.reachable ? 1 : 0) - (a.reachable ? 1 : 0)
    || a.distance - b.distance || a.purchases.length - b.purchases.length)[0];
}

/** Where a seed sits, briefly. */
function seedWhere(seed) {
  return seed.slot < 9 ? 'in your tray' : 'in the drawer';
}

/**
 * The chosen goal's steps in execution order, each with a status read off
 * the save: done (its result is already there), current (first not done),
 * upcoming (the rest).
 */
export function buildRoad(save, goal) {
  if (!goal || goal.found) return [];
  const steps = [];
  for (const p of goal.purchases) steps.push({ ...p, done: false });

  const growing = (species) => save.pots.find((p) => p.planted && p.species && speciesKey(p.species) === speciesKey(species));
  const seedOf = (species) => (save.seeds || []).find((s) => s.species && speciesKey(s.species) === speciesKey(species));

  goal.crosses.forEach((step, i) => {
    for (const parent of [step.a, step.b]) {
      if (fertilePot(save, parent)) continue;
      const pol = save.pots.find((p) => p.pollinated && p.species && speciesKey(p.species) === speciesKey(parent));
      const young = save.pots.find((p) => p.planted && !p.canPollinate && !p.pollinated && !p.depleted
        && p.species && speciesKey(p.species) === speciesKey(parent));
      const sd = seedOf(parent);
      if (pol) {
        steps.push({ kind: 'wait', pot: pol.index, done: false,
          text: `Wait for pot ${pol.index + 1} to drop its seeds (${speciesName(parent)})` });
      } else if (young) {
        steps.push({ kind: 'wait', pot: young.index, done: false,
          text: `Let pot ${young.index + 1} grow (${speciesName(parent)}) until it can pollinate` });
      } else if (sd) {
        steps.push({ kind: 'plant', seedSlot: sd.slot, done: false,
          text: `Plant ${speciesName(parent)} (${seedWhere(sd)}) and let it grow` });
      }
      // Otherwise the parent is the child of an earlier cross: that cross covers it.
    }
    const a = fertilePot(save, step.a);
    const b = fertilePot(save, step.b);
    const childHeld = !!(growing(step.result) || seedOf(step.result));
    steps.push({
      kind: 'cross', done: childHeld,
      pots: a && b ? [a.index, b.index] : undefined,
      text: a && b
        ? `Cross pot ${a.index + 1} with pot ${b.index + 1} → ${speciesName(step.result)}`
        : `Cross ${speciesName(step.a)} with ${speciesName(step.b)} → ${speciesName(step.result)}`,
    });
    const isLast = i === goal.crosses.length - 1;
    if (!isLast) {
      const sd = seedOf(step.result);
      steps.push({ kind: 'plant', done: !!growing(step.result), seedSlot: sd ? sd.slot : undefined,
        text: `Plant ${speciesName(step.result)}${sd ? ` (${seedWhere(sd)})` : ''} and let it grow` });
    }
  });

  let currentSet = false;
  return steps.map((s) => {
    const { done, ...rest } = s;
    let status = 'upcoming';
    if (done) status = 'done';
    else if (!currentSet) { status = 'current'; currentSet = true; }
    return { ...rest, status };
  });
}

/** The whole plan: every goal rated, one chosen, its road, and the phase. */
export function campaign(save, pick) {
  const goals = MAGIC_PLANTS.map((m) => rateGoal(save, m));
  const goal = chooseGoal(goals, pick);
  if (!goal) return { goals, goal: null, phase: 'done', road: [], earn: null };
  const road = buildRoad(save, goal);
  const current = road.find((s) => s.status === 'current');
  const earn = current && current.kind === 'buy' && current.cost > (save.cash || 0)
    ? { target: current.cost, item: current.item, have: save.cash || 0 }
    : null;
  return { goals, goal, phase: earn ? 'earn' : 'breed', road, earn };
}
