import { describe, expect, it } from "vitest";
import { buildFoldSim } from "./foldSim";
import { PATTERNS, type PatternEntry } from "./patterns/library";
import { accordion } from "./patterns/pleats";

/**
 * Realism acceptance for the fold simulation, per pattern family.
 *
 * The paper must never tear (strain), never explode (bounds/NaN), and must
 * genuinely fold (progress). How far it folds and how flat it lands depends
 * on physics, not wishes:
 *  - rigid-foldable patterns (pleats, maps, miura, bases, small starbursts)
 *    reach their driven target and land in a flat stack;
 *  - twists are famously NOT rigid-foldable — they equilibrate mostly
 *    folded with visible bending;
 *  - waterbomb tessellations curl out-of-plane into their tube form rather
 *    than pressing flat (that is their real folded shape).
 */
interface Expectation {
  minProgress: number;
  /** Max folded z-extent as a fraction of paper size. */
  maxZRatio: number;
}

const expectationFor = (pattern: PatternEntry): Expectation => {
  if (pattern.category === "twists") {
    return { minProgress: 0.7, maxZRatio: 0.9 };
  }
  if (pattern.slug.startsWith("magic-ball")) {
    return { minProgress: 0.6, maxZRatio: 0.8 };
  }
  if (pattern.slug === "fish-base" || pattern.slug === "preliminary-base") {
    return { minProgress: 0.8, maxZRatio: 0.5 };
  }
  if (pattern.slug === "herringbone") {
    // The extreme shear stiffens the corrugation; it settles just short.
    return { minProgress: 0.9, maxZRatio: 0.45 };
  }
  if (pattern.slug === "starburst-12") {
    // Dense single vertex: the cone of flaps stays slightly open.
    return { minProgress: 0.9, maxZRatio: 0.55 };
  }
  return { minProgress: 0.95, maxZRatio: 0.35 };
};

const zExtent = (sim: ReturnType<typeof buildFoldSim>): number => {
  let min = Infinity;
  let max = -Infinity;
  for (let n = 0; n < sim.nodeCount; n++) {
    const z = sim.positions[n * 3 + 2];
    min = Math.min(min, z);
    max = Math.max(max, z);
  }
  return max - min;
};

describe("fold simulation", () => {
  it("folds a lone mountain crease downward (sign convention)", () => {
    // accordion(2) has a single crease at k=1 → mountain → folds to −z.
    const sim = buildFoldSim(accordion(2, "half"));
    sim.step(0.5, 300);
    let minZ = 0;
    for (let n = 0; n < sim.nodeCount; n++) {
      minZ = Math.min(minZ, sim.positions[n * 3 + 2]);
    }
    expect(minZ).toBeLessThan(-20);
    expect(sim.maxStrain()).toBeLessThan(0.05);
  });

  it("folds valley creases upward", () => {
    // accordion(4): creases alternate M,V,M — the valley wings rise.
    const sim = buildFoldSim(accordion(4));
    sim.step(0.5, 300);
    let maxZ = 0;
    for (let n = 0; n < sim.nodeCount; n++) {
      maxZ = Math.max(maxZ, sim.positions[n * 3 + 2]);
    }
    expect(maxZ).toBeGreaterThan(10);
  });

  it("reset returns to the flat sheet", () => {
    const sim = buildFoldSim(accordion(4));
    sim.step(1, 200);
    sim.reset();
    expect(zExtent(sim)).toBe(0);
    expect(sim.maxStrain()).toBe(0);
  });

  for (const pattern of PATTERNS) {
    const expectation = expectationFor(pattern);
    // Dense meshes take several seconds of simulation under parallel load.
    it(`${pattern.title}: folds realistically (progress ≥ ${expectation.minProgress}, no tearing)`, { timeout: 90_000 }, () => {
      const doc = pattern.build();
      const size = Math.max(doc.paper.width, doc.paper.height);
      const sim = buildFoldSim(doc, pattern.simOptions);
      sim.rampTo(0, 1);
      sim.step(1, 500);

      // Finite everywhere — no numerical blow-up.
      for (let i = 0; i < sim.positions.length; i++) {
        expect(Number.isFinite(sim.positions[i])).toBe(true);
      }
      // The paper never tears or stretches: the mesh is connected by
      // construction and bar strain stays small.
      expect(sim.maxStrain()).toBeLessThan(0.1);
      // The model stays near the sheet (no explosion).
      for (let n = 0; n < sim.nodeCount; n++) {
        expect(Math.abs(sim.positions[n * 3] - size / 2)).toBeLessThan(size * 1.6);
        expect(Math.abs(sim.positions[n * 3 + 1] - size / 2)).toBeLessThan(size * 1.6);
        expect(Math.abs(sim.positions[n * 3 + 2])).toBeLessThan(size * 1.2);
      }
      // It genuinely folds…
      expect(sim.foldProgress(1)).toBeGreaterThanOrEqual(expectation.minProgress);
      // …and lands in its family's expected shape.
      expect(zExtent(sim) / size).toBeLessThanOrEqual(expectation.maxZRatio);
    });
  }
});
