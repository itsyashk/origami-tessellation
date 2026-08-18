/**
 * Twist folds: a central regular n-gon rotates while pleat pairs radiate
 * from its corners to the paper edge.
 *
 * Corner geometry (interior angle θ = 180(n−2)/n, pleat half-angle
 * δ = (180−θ)/2): sorted sectors are (θ, 90+δ, 2δ, 90−δ). Alternating sums
 * are θ+2δ = 180 and (90+δ)+(90−δ) = 180 — Kawasaki holds at every corner
 * for every n. Assignments: polygon edges + first pleat mountain, second
 * pleat valley → 3M/1V (Maekawa +2). Successive corners' pleat creases are
 * parallel (they differ by exactly the polygon's exterior angle), so pleats
 * never cross each other — the classic parallel pleat pairs of twist folds.
 */

import type { OrigamiDocument } from "../model";
import { normalizeAngle } from "@/geometry/angles";
import { PatternBuilder, PAPER, degToRadP, rayToBoundary } from "./util";

const S = PAPER;

export interface TwistOptions {
  /** Circumradius of the central polygon. */
  radius?: number;
  /** Rotation of the whole polygon, degrees. */
  rotateDegrees?: number;
  name?: string;
}

export const polygonTwist = (
  n: number,
  options: TwistOptions = {},
): OrigamiDocument => {
  const {
    radius = n <= 4 ? 42 : 40,
    rotateDegrees = -90 + 180 / n,
    name = `${["", "", "", "Triangle", "Square", "Pentagon", "Hexagon", "Heptagon", "Octagon"][n] ?? `${n}-gon`} Twist`,
  } = options;

  const b = new PatternBuilder(name);
  const center = { x: S / 2, y: S / 2 };
  const corners = Array.from({ length: n }, (_, k) => {
    const angle = degToRadP(rotateDegrees) + (k * 2 * Math.PI) / n;
    return {
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    };
  });

  const theta = (Math.PI * (n - 2)) / n;
  const delta = (Math.PI - theta) / 2;

  for (let k = 0; k < n; k++) {
    const corner = corners[k];
    const next = corners[(k + 1) % n];
    const prev = corners[(k + n - 1) % n];
    // Polygon edge (drawn once per pair thanks to builder dedupe).
    b.crease(corner, next, "mountain");

    const e2 = normalizeAngle(Math.atan2(prev.y - corner.y, prev.x - corner.x));
    const p1 = e2 + Math.PI / 2 + delta;
    const p2 = p1 + 2 * delta;
    b.crease(corner, rayToBoundary(corner, p1), "mountain");
    b.crease(corner, rayToBoundary(corner, p2), "valley");
  }
  return b.build();
};
