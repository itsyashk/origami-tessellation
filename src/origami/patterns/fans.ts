/**
 * Single-vertex studies: one interior vertex, n creases radiating to the
 * paper edge. Equal sectors satisfy Kawasaki for any even n; alternating
 * assignments with one flip give Maekawa's ±2. These are the cleanest
 * patterns for learning the two theorems.
 */

import type { OrigamiDocument } from "../model";
import { PatternBuilder, PAPER, rayToBoundary } from "./util";

const S = PAPER;

/** n equally spaced creases (n even) around a central vertex. */
export const starburst = (n: number, name = `Starburst ${n}`): OrigamiDocument => {
  const b = new PatternBuilder(name);
  const center = { x: S / 2, y: S / 2 };
  for (let k = 0; k < n; k++) {
    const angle = (k * 2 * Math.PI) / n + Math.PI / n;
    // Alternate M/V, then flip the last valley to mountain so the counts
    // are (n/2 + 1) − (n/2 − 1) = +2 — Maekawa without breaking symmetry
    // anywhere it matters (all sectors are equal, so no big-little-big
    // constraint binds).
    const valley = k % 2 === 1 && k !== n - 1;
    b.crease(center, rayToBoundary(center, angle), valley ? "valley" : "mountain");
  }
  return b.build();
};

/**
 * The bird's-foot study: a degree-4 vertex with sectors 90/135/90/45 —
 * asymmetric, so dragging any endpoint shows Kawasaki reacting.
 */
export const birdsFoot = (): OrigamiDocument => {
  const b = new PatternBuilder("Bird's Foot Study");
  const center = { x: S / 2, y: S / 2 };
  // Stable semantic ids — tests and tutorials refer to these by name.
  b.vertex(center, "center");
  b.vertex({ x: S, y: S / 2 }, "east");
  b.vertex({ x: S / 2, y: S }, "north");
  b.vertex({ x: 0, y: 0 }, "sw");
  b.vertex({ x: S, y: 0 }, "se");
  b.crease(center, { x: S, y: S / 2 }, "mountain");
  b.crease(center, { x: S / 2, y: S }, "mountain");
  b.crease(center, { x: 0, y: 0 }, "mountain");
  b.crease(center, { x: S, y: 0 }, "valley");
  return b.build();
};
