/**
 * Built-in example patterns. These are ordinary OrigamiDocuments — nothing
 * in rendering or analysis knows about them specially.
 *
 * The square twist is constructed programmatically with 4-fold rotational
 * symmetry. Each corner of the central square is a degree-4 interior vertex
 * with sector angles 45°/90°/135°/90° (alternating sums both 180°, so
 * Kawasaki holds) and a 3-mountain/1-valley assignment (Maekawa: +2), with
 * the unique smallest sector bounded by one mountain and one valley.
 */

import type { CreaseAssignment, OrigamiDocument } from "./model";

interface V {
  id: string;
  x: number;
  y: number;
}
interface C {
  id: string;
  s: string;
  e: string;
  a: CreaseAssignment;
}

const doc = (
  name: string,
  size: number,
  vertices: V[],
  creases: C[],
): OrigamiDocument => ({
  version: 1,
  name,
  paper: { width: size, height: size },
  vertices: vertices.map(({ id, x, y }) => ({ id, x, y })),
  creases: creases.map(({ id, s, e, a }) => ({
    id,
    startVertexId: s,
    endVertexId: e,
    assignment: a,
  })),
});

/** Classic square-twist crease pattern (45° twist), fully flat-foldable. */
export const squareTwist = (): OrigamiDocument =>
  doc(
    "Square Twist",
    200,
    [
      // Central square corners
      { id: "sq_a", x: 80, y: 80 },
      { id: "sq_b", x: 120, y: 80 },
      { id: "sq_c", x: 120, y: 120 },
      { id: "sq_d", x: 80, y: 120 },
      // Pleat endpoints on the paper boundary
      { id: "ba_diag", x: 0, y: 0 }, //     from A along 225°
      { id: "ba_side", x: 160, y: 0 }, //   from A along 315°
      { id: "bb_diag", x: 200, y: 0 }, //   from B along 315°
      { id: "bb_side", x: 200, y: 160 }, // from B along 45°
      { id: "bc_diag", x: 200, y: 200 }, // from C along 45°
      { id: "bc_side", x: 40, y: 200 }, //  from C along 135°
      { id: "bd_diag", x: 0, y: 200 }, //   from D along 135°
      { id: "bd_side", x: 0, y: 40 }, //    from D along 225°
    ],
    [
      // Central square — all mountains
      { id: "sq_ab", s: "sq_a", e: "sq_b", a: "mountain" },
      { id: "sq_bc", s: "sq_b", e: "sq_c", a: "mountain" },
      { id: "sq_cd", s: "sq_c", e: "sq_d", a: "mountain" },
      { id: "sq_da", s: "sq_d", e: "sq_a", a: "mountain" },
      // Pleats: diagonal crease mountain, side crease valley (per corner)
      { id: "pl_a1", s: "sq_a", e: "ba_diag", a: "mountain" },
      { id: "pl_a2", s: "sq_a", e: "ba_side", a: "valley" },
      { id: "pl_b1", s: "sq_b", e: "bb_diag", a: "mountain" },
      { id: "pl_b2", s: "sq_b", e: "bb_side", a: "valley" },
      { id: "pl_c1", s: "sq_c", e: "bc_diag", a: "mountain" },
      { id: "pl_c2", s: "sq_c", e: "bc_side", a: "valley" },
      { id: "pl_d1", s: "sq_d", e: "bd_diag", a: "mountain" },
      { id: "pl_d2", s: "sq_d", e: "bd_side", a: "valley" },
    ],
  );

/**
 * A single degree-4 vertex ("bird's foot") — the simplest playground for
 * watching Kawasaki respond live while dragging. Sector angles are
 * 90°/45°/90°/135°, so it starts flat-foldable.
 */
export const singleVertexPlayground = (): OrigamiDocument =>
  doc(
    "Single Vertex Study",
    200,
    [
      { id: "center", x: 100, y: 100 },
      { id: "east", x: 200, y: 100 },
      { id: "north", x: 100, y: 200 },
      // 225°: down-left diagonal to the paper corner
      { id: "sw", x: 0, y: 0 },
      // 315°: down-right diagonal to the paper corner
      { id: "se", x: 200, y: 0 },
    ],
    [
      { id: "r_e", s: "center", e: "east", a: "mountain" },
      { id: "r_n", s: "center", e: "north", a: "mountain" },
      { id: "r_sw", s: "center", e: "sw", a: "mountain" },
      { id: "r_se", s: "center", e: "se", a: "valley" },
    ],
  );

export interface ExampleEntry {
  slug: string;
  title: string;
  description: string;
  build: () => OrigamiDocument;
}

export const EXAMPLES: ExampleEntry[] = [
  {
    slug: "square-twist",
    title: "Square Twist",
    description:
      "The classic flat-foldable twist — four pleats rotate a central square 45°.",
    build: squareTwist,
  },
  {
    slug: "single-vertex",
    title: "Single Vertex Study",
    description:
      "One degree-4 vertex. Drag its creases and watch Kawasaki respond live.",
    build: singleVertexPlayground,
  },
];
