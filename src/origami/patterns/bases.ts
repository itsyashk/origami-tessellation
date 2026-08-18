/**
 * Traditional bases and beginner folds. Constructions follow the classical
 * geometry; every interior vertex is Kawasaki/Maekawa-valid by design and
 * verified in tests.
 */

import type { OrigamiDocument } from "../model";
import { PatternBuilder, PAPER } from "./util";

const S = PAPER;

/** Book fold: one valley down the middle. */
export const bookFold = (): OrigamiDocument => {
  const b = new PatternBuilder("Book Fold");
  b.crease({ x: S / 2, y: 0 }, { x: S / 2, y: S }, "valley");
  return b.build();
};

/** Gate fold: both quarter lines fold inward. */
export const gateFold = (): OrigamiDocument => {
  const b = new PatternBuilder("Gate Fold");
  b.crease({ x: S / 4, y: 0 }, { x: S / 4, y: S }, "valley");
  b.crease({ x: (3 * S) / 4, y: 0 }, { x: (3 * S) / 4, y: S }, "valley");
  return b.build();
};

/** Blintz base: all four corners fold to the center. */
export const blintzBase = (): OrigamiDocument => {
  const b = new PatternBuilder("Blintz Base");
  const mid = S / 2;
  b.crease({ x: mid, y: 0 }, { x: S, y: mid }, "valley");
  b.crease({ x: S, y: mid }, { x: mid, y: S }, "valley");
  b.crease({ x: mid, y: S }, { x: 0, y: mid }, "valley");
  b.crease({ x: 0, y: mid }, { x: mid, y: 0 }, "valley");
  return b.build();
};

/** Kite base: two edges fold onto the diagonal. */
export const kiteBase = (): OrigamiDocument => {
  const b = new PatternBuilder("Kite Base");
  const t = Math.tan(Math.PI / 8) * S; // ≈ 82.84
  b.crease({ x: 0, y: 0 }, { x: S, y: S }, "mountain");
  b.crease({ x: 0, y: 0 }, { x: S, y: t }, "valley");
  b.crease({ x: 0, y: 0 }, { x: t, y: S }, "valley");
  return b.build();
};

/**
 * Fish base: a rabbit ear on each side of the diagonal. The two incenter
 * vertices are the first interior vertices most folders ever meet; each is
 * degree 4 with sectors 135°/67.5°/45°/112.5° (Kawasaki ✓) and 3V+1M
 * (Maekawa ✓).
 */
export const fishBase = (): OrigamiDocument => {
  const b = new PatternBuilder("Fish Base");
  // Incenter of the triangle (0,0), (S,0), (S,S).
  const inc = S / (2 + Math.SQRT2); // ≈ 58.58
  const i1 = { x: S - inc, y: inc };
  const i2 = { x: inc, y: S - inc };
  b.crease({ x: 0, y: 0 }, { x: S, y: S }, "mountain");
  // Lower rabbit ear
  b.crease({ x: 0, y: 0 }, i1, "valley");
  b.crease({ x: S, y: S }, i1, "valley");
  b.crease({ x: S, y: 0 }, i1, "valley");
  b.crease(i1, { x: S - inc, y: 0 }, "mountain");
  // Upper rabbit ear (mirror)
  b.crease({ x: 0, y: 0 }, i2, "valley");
  b.crease({ x: S, y: S }, i2, "valley");
  b.crease({ x: 0, y: S }, i2, "valley");
  b.crease(i2, { x: 0, y: S - inc }, "mountain");
  return b.build();
};

/**
 * Waterbomb base: both diagonals mountain, one book fold valley. The center
 * is the classic degree-6 waterbomb vertex (sectors 45/90/45/45/90/45).
 */
export const waterbombBase = (): OrigamiDocument => {
  const b = new PatternBuilder("Waterbomb Base");
  const c = { x: S / 2, y: S / 2 };
  b.crease(c, { x: 0, y: 0 }, "mountain");
  b.crease(c, { x: S, y: S }, "mountain");
  b.crease(c, { x: S, y: 0 }, "mountain");
  b.crease(c, { x: 0, y: S }, "mountain");
  b.crease(c, { x: 0, y: S / 2 }, "valley");
  b.crease(c, { x: S, y: S / 2 }, "valley");
  return b.build();
};

/** Preliminary base: the waterbomb base inside-out. */
export const preliminaryBase = (): OrigamiDocument => {
  const b = new PatternBuilder("Preliminary Base");
  const c = { x: S / 2, y: S / 2 };
  b.crease(c, { x: 0, y: 0 }, "valley");
  b.crease(c, { x: S, y: S }, "valley");
  b.crease(c, { x: S, y: 0 }, "valley");
  b.crease(c, { x: 0, y: S }, "valley");
  b.crease(c, { x: S / 2, y: 0 }, "mountain");
  b.crease(c, { x: S / 2, y: S }, "mountain");
  return b.build();
};
