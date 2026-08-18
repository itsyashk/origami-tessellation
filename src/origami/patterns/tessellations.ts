/**
 * Corrugation tessellations: Miura-ori and the waterbomb tessellation
 * ("magic ball"). Both are generated over a grid with every interior vertex
 * flat-foldable by construction (verified in tests):
 *
 * Miura vertex: collinear horizontals + a zigzag vertical → sectors
 * (90−α, 90+α, 90+α, 90−α); vertical assignment alternates per row band, so
 * counts are 3/1.
 *
 * Waterbomb vertex (cell centers and cell corners alike): two collinear
 * mountain horizontals + four valley diagonals → sectors
 * (α, 180−2α, α, α, 180−2α, α) and 2M/4V = −2.
 */

import type { OrigamiDocument, CreaseAssignment } from "../model";
import { PatternBuilder, PAPER } from "./util";

const S = PAPER;
const mv = (flag: boolean): CreaseAssignment => (flag ? "mountain" : "valley");

export const miuraOri = (
  rows: number,
  cols: number,
  shear = 0.35,
  name = `Miura-ori ${cols}×${rows}`,
): OrigamiDocument => {
  const b = new PatternBuilder(name);
  const rowH = S / rows;
  const off = (shear * S) / cols;
  const colW = (S - off) / cols;
  const x = (i: number, j: number) => j * colW + (i % 2) * off;
  const y = (i: number) => i * rowH;

  // Horizontal creases: full width, alternating assignment per row.
  for (let i = 1; i < rows; i++) {
    const points = [
      { x: 0, y: y(i) },
      ...Array.from({ length: cols + 1 }, (_, j) => ({ x: x(i, j), y: y(i) })),
      { x: S, y: y(i) },
    ];
    b.polyline(points, mv(i % 2 === 1));
  }
  // Zigzag "vertical" creases: assignment alternates per row band, so each
  // vertex sees one mountain and one valley vertical.
  for (let j = 0; j <= cols; j++) {
    for (let i = 0; i < rows; i++) {
      b.crease(
        { x: x(i, j), y: y(i) },
        { x: x(i + 1, j), y: y(i + 1) },
        mv(i % 2 === 0),
      );
    }
  }
  return b.build();
};

export const waterbombTessellation = (
  rows: number,
  cols: number,
  name = `Magic Ball ${cols}×${rows}`,
): OrigamiDocument => {
  const b = new PatternBuilder(name);
  const cw = S / cols;
  const ch = S / rows;

  // Full-width mountain horizontals at every half-row: through cell corners
  // (whole rows) and through cell centers (half rows).
  for (let k = 1; k < 2 * rows; k++) {
    const yLine = (k * ch) / 2;
    const isCenterRow = k % 2 === 1;
    const anchors = isCenterRow
      ? [
          { x: 0, y: yLine },
          ...Array.from({ length: cols }, (_, j) => ({
            x: (j + 0.5) * cw,
            y: yLine,
          })),
          { x: S, y: yLine },
        ]
      : Array.from({ length: cols + 1 }, (_, j) => ({ x: j * cw, y: yLine }));
    b.polyline(anchors, "mountain");
  }

  // Valley half-diagonals from each cell center to its four corners.
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const c = { x: (j + 0.5) * cw, y: (i + 0.5) * ch };
      b.crease(c, { x: j * cw, y: i * ch }, "valley");
      b.crease(c, { x: (j + 1) * cw, y: i * ch }, "valley");
      b.crease(c, { x: (j + 1) * cw, y: (i + 1) * ch }, "valley");
      b.crease(c, { x: j * cw, y: (i + 1) * ch }, "valley");
    }
  }
  return b.build();
};
