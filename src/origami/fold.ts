/**
 * The flat-folding map, animated.
 *
 * Every face gets a rigid transform: pick a root face, span the face graph
 * with a BFS tree over shared creases, and give each child the parent's
 * transform composed with a rotation about the shared crease line (in crease
 * pattern coordinates). Valley creases rotate the child toward the viewer
 * (+z), mountains away, by t·π:
 *
 *   t = 0  →  identity everywhere (the flat sheet)
 *   t = 1  →  rotation by ±π = reflection across the crease line — exactly
 *             the classical flat-fold map, so the pattern lands flat.
 *
 * Between 0 and 1 the sheet folds in 3D. Creases not in the tree are not
 * explicitly constrained: patterns that are not rigidly foldable with flat
 * panels (the square twist, famously) will visibly tear at loop-closure
 * creases mid-animation — real paper resolves this by bending. The endpoints
 * (flat and fully folded) are always consistent for locally flat-foldable
 * input. Unassigned creases stay flat, so their subtree simply doesn't fold.
 *
 * BFS depth also serves as the display stacking order; true layer ordering
 * is a hard combinatorial problem left for a future milestone.
 */

import { cross, normalize, sub, type Vec2 } from "@/geometry/vec2";
import {
  MAT_IDENTITY,
  multiplyMat,
  rotationAboutLine,
  type Mat34,
} from "@/geometry/mat3d";
import { extractFaces, type FaceGraph } from "./faces";
import type { OrigamiDocument } from "./model";

export interface FoldHinge {
  parent: number;
  /** Axis through a→b, oriented so the child face lies to its left. */
  a: Vec2;
  dir: Vec2;
  /** +1 valley (folds toward +z), −1 mountain, 0 unassigned (stays flat). */
  sign: 1 | -1 | 0;
}

export interface FoldModel {
  graph: FaceGraph;
  root: number;
  /** Hinge per face index; null for the root and unreachable faces. */
  hinges: (FoldHinge | null)[];
  /** BFS depth per face (root = 0). */
  depths: number[];
  /**
   * Signed stacking hint per face: cumulative fold signs along the tree
   * path (valley children stack above their parent, mountains below).
   * A display heuristic only — true layer ordering is future work.
   */
  layers: number[];
  unassignedHingeCount: number;
}

const pointInPolygon = (p: Vec2, polygon: Vec2[]): boolean => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    ) {
      inside = !inside;
    }
  }
  return inside;
};

export const buildFoldModel = (doc: OrigamiDocument): FoldModel => {
  const graph = extractFaces(doc);
  const { faces, adjacencies } = graph;

  // Root: the face under the paper center reads as "the part that stays
  // put" (the central square of a twist); fall back to the largest face.
  const center = { x: doc.paper.width / 2, y: doc.paper.height / 2 };
  let root = faces.findIndex((f) => pointInPolygon(center, f.polygon));
  if (root < 0) {
    root = 0;
    for (let i = 1; i < faces.length; i++) {
      if (faces[i].area > faces[root].area) root = i;
    }
  }
  if (faces.length === 0) {
    return {
      graph,
      root: 0,
      hinges: [],
      depths: [],
      layers: [],
      unassignedHingeCount: 0,
    };
  }

  const neighborLists = new Map<number, { other: number; adjacency: number }[]>();
  adjacencies.forEach((adj, index) => {
    for (const [from, to] of [
      [adj.faceA, adj.faceB],
      [adj.faceB, adj.faceA],
    ] as const) {
      const list = neighborLists.get(from) ?? [];
      list.push({ other: to, adjacency: index });
      neighborLists.set(from, list);
    }
  });

  const hinges: (FoldHinge | null)[] = faces.map(() => null);
  const depths: number[] = faces.map(() => 0);
  const layers: number[] = faces.map(() => 0);
  const seen = new Set<number>([root]);
  const queue = [root];
  let unassignedHingeCount = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const { other, adjacency } of neighborLists.get(current) ?? []) {
      if (seen.has(other)) continue;
      seen.add(other);
      const adj = adjacencies[adjacency];
      let dir = normalize(sub(adj.b, adj.a));
      // Orient the axis so the child sits on its left: a positive rotation
      // then lifts the child toward +z (valley).
      if (cross(dir, sub(faces[other].centroid, adj.a)) < 0) {
        dir = { x: -dir.x, y: -dir.y };
      }
      const sign =
        adj.assignment === "valley" ? 1 : adj.assignment === "mountain" ? -1 : 0;
      if (sign === 0) unassignedHingeCount++;
      hinges[other] = { parent: current, a: adj.a, dir, sign };
      depths[other] = depths[current] + 1;
      layers[other] = layers[current] + sign;
      queue.push(other);
    }
  }

  return { graph, root, hinges, depths, layers, unassignedHingeCount };
};

/**
 * Rigid transform per face at fold fraction `t` ∈ [0, 1].
 * Children compose in BFS order, so parents are always resolved first.
 */
export const foldedFaceTransforms = (model: FoldModel, t: number): Mat34[] => {
  const { graph, hinges, depths } = model;
  const transforms: Mat34[] = graph.faces.map(() => MAT_IDENTITY);
  // Process by increasing depth so parent transforms exist before children.
  const order = graph.faces
    .map((_, i) => i)
    .sort((a, b) => depths[a] - depths[b]);
  for (const index of order) {
    const hinge = hinges[index];
    if (!hinge) continue; // root (or a face untouched by any crease path)
    const local = rotationAboutLine(hinge.a, hinge.dir, t * Math.PI * hinge.sign);
    transforms[index] = multiplyMat(transforms[hinge.parent], local);
  }
  return transforms;
};
