/**
 * Pleats and map folds. Accordions have no interior vertices; the map fold
 * grid is the classic flat-foldable assignment where each horizontal crease
 * flips mountain/valley every time it crosses a vertical one.
 */

import type { OrigamiDocument, CreaseAssignment } from "../model";
import { PatternBuilder, PAPER } from "./util";

const S = PAPER;
const mv = (flag: boolean): CreaseAssignment => (flag ? "mountain" : "valley");

/** Vertical accordion pleats. */
export const accordion = (folds: number, name = `Accordion ×${folds}`): OrigamiDocument => {
  const b = new PatternBuilder(name);
  for (let k = 1; k < folds; k++) {
    const x = (k * S) / folds;
    b.crease({ x, y: 0 }, { x, y: S }, mv(k % 2 === 1));
  }
  return b.build();
};

/** Accordion pleats running parallel to the main diagonal. */
export const diagonalPleats = (folds: number): OrigamiDocument => {
  const b = new PatternBuilder("Diagonal Pleats");
  for (let k = 1; k < folds; k++) {
    // Lines x + y = c, from c = spacing … 2S − spacing.
    const c = (k * 2 * S) / folds;
    const start = c <= S ? { x: c, y: 0 } : { x: S, y: c - S };
    const end = c <= S ? { x: 0, y: c } : { x: c - S, y: S };
    b.crease(start, end, mv(k % 2 === 1));
  }
  return b.build();
};

/**
 * Map fold: a full grid where vertical lines carry one assignment and every
 * horizontal segment flips as it crosses a vertical crease — so each grid
 * vertex sees {A, A, M, V}, giving Maekawa ±2 with right-angle sectors.
 */
export const mapFold = (
  rows: number,
  cols: number,
  name = `Map Fold ${cols}×${rows}`,
): OrigamiDocument => {
  const b = new PatternBuilder(name);
  const xs = Array.from({ length: cols + 1 }, (_, j) => (j * S) / cols);
  const ys = Array.from({ length: rows + 1 }, (_, i) => (i * S) / rows);

  for (let j = 1; j < cols; j++) {
    b.polyline(
      ys.map((y) => ({ x: xs[j], y })),
      mv(j % 2 === 1),
    );
  }
  for (let i = 1; i < rows; i++) {
    for (let c = 0; c < cols; c++) {
      b.crease(
        { x: xs[c], y: ys[i] },
        { x: xs[c + 1], y: ys[i] },
        mv((i + c) % 2 === 0),
      );
    }
  }
  return b.build();
};
