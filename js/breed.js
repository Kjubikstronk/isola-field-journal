import { TIERS, speciesKey, keyToSpecies } from './species.js';

/**
 * The whole breeding system, verified against the wiki's 529-cell chart and
 * three independent published walkthrough results:
 *
 *   offspring_tier = ceil((parentA_tier + parentB_tier) / 2)
 *
 * applied to the foliage and flower axes completely independently.
 */
export const crossTier = (a, b) => Math.ceil((a + b) / 2);

export function cross(a, b) {
  return { f: crossTier(a.f, b.f), w: crossTier(a.w, b.w) };
}

/**
 * Because the offspring tier is an average, it can never exceed the higher
 * parent. So your highest owned tier on each axis is a hard ceiling that
 * breeding alone can never break -- you must raise it by buying shop seeds
 * or using Mutation Liquid. This is the single most important strategic fact
 * in the game and the thing that makes progression feel stuck.
 */
export function ceilings(owned) {
  return {
    f: Math.max(...owned.map((s) => s.f)),
    w: Math.max(...owned.map((s) => s.w)),
  };
}

/** The lowest rank on each axis. Averaging never goes below the lowest parent either. */
export function floors(owned) {
  return {
    f: Math.min(...owned.map((s) => s.f)),
    w: Math.min(...owned.map((s) => s.w)),
  };
}

export function isReachable(owned, target) {
  const c = ceilings(owned);
  const l = floors(owned);
  return target.f <= c.f && target.w <= c.w && target.f >= l.f && target.w >= l.w;
}

/**
 * Shortest sequence of crosses from `owned` to `target`.
 * Breadth-first over the set of species you hold, with a beam limit so the
 * branching factor stays sane. Real paths are 2-4 crosses, so this is fast.
 * Returns [] if already owned, null if unreachable within the limits.
 */
export function findPath(owned, target, { maxDepth = 5, beam = 400 } = {}) {
  const targetKey = speciesKey(target);
  const startKeys = [...new Set(owned.map(speciesKey))].sort((x, y) => x - y);
  if (startKeys.includes(targetKey)) return [];
  if (!isReachable(owned, target)) return null;

  const seen = new Set([startKeys.join(',')]);
  let frontier = [{ keys: startKeys, steps: [] }];

  for (let depth = 0; depth < maxDepth; depth++) {
    const next = [];
    for (const node of frontier) {
      const list = node.keys.map(keyToSpecies);
      for (let i = 0; i < list.length; i++) {
        for (let j = i; j < list.length; j++) {
          const child = cross(list[i], list[j]);
          const childKey = speciesKey(child);
          if (node.keys.includes(childKey)) continue; // self-pollination / no gain
          const step = { a: list[i], b: list[j], result: child };
          const steps = [...node.steps, step];
          if (childKey === targetKey) return steps;
          const keys = [...node.keys, childKey].sort((x, y) => x - y);
          const sig = keys.join(',');
          if (seen.has(sig)) continue;
          seen.add(sig);
          next.push({ keys, steps });
        }
      }
    }
    if (!next.length) break;
    // Keep the nodes whose holdings sit closest to the target on both axes.
    next.sort((p, q) => score(p, target) - score(q, target));
    frontier = next.slice(0, beam);
  }
  return null;
}

function score(node, target) {
  let best = Infinity;
  for (const k of node.keys) {
    const s = keyToSpecies(k);
    best = Math.min(best, Math.abs(s.f - target.f) + Math.abs(s.w - target.w));
  }
  return best;
}

/** Every species obtainable from `owned` within `maxDepth` crosses. */
export function reachableSpecies(owned, maxDepth = 3) {
  let pool = new Set(owned.map(speciesKey));
  for (let d = 0; d < maxDepth; d++) {
    const list = [...pool].map(keyToSpecies);
    for (let i = 0; i < list.length; i++)
      for (let j = i; j < list.length; j++)
        pool.add(speciesKey(cross(list[i], list[j])));
  }
  return [...pool].map(keyToSpecies);
}

export { TIERS };
