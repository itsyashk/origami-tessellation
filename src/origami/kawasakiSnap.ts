/**
 * "Snap to flat-foldable": when a dragged vertex brings the pattern close to
 * satisfying Kawasaki's theorem, find a nearby position that satisfies it
 * exactly and offer that position as a snap target.
 *
 * The objective is the sum of squared Kawasaki residuals over every interior
 * vertex whose sectors depend on the dragged vertex (the vertex itself plus
 * its neighbors). We minimize with a small damped coordinate-descent using
 * finite differences — the neighborhood is tiny (a few vertices), so ~60
 * evaluations stay comfortably within a pointer-move frame budget.
 */

import {
  adjacencyMap,
  moveVertex,
  otherEndpoint,
  vertexMap,
  type OrigamiDocument,
} from "./model";
import { analyzeKawasaki } from "./analysis";
import { isOnPaperBoundary } from "./model";
import type { Vec2 } from "@/geometry/vec2";
import { FOLDABILITY_ANGLE_TOLERANCE } from "@/geometry/tolerance";

export interface KawasakiSnapResult {
  /** Position that makes all affected vertices Kawasaki-valid. */
  position: Vec2;
  /** Residual error at the snapped position, radians (should be ~0). */
  residual: number;
  /** Interior vertex ids that become valid by this snap. */
  affectedVertexIds: string[];
}

/**
 * Try to find a position near `proposed` for `draggedId` that makes every
 * affected interior vertex satisfy Kawasaki exactly.
 *
 * Returns null when there is nothing to solve, when the search does not
 * converge, or when the solution is farther than `maxSnapDistance` from the
 * proposed position (snapping should feel like a nudge, never a jump).
 */
export const findKawasakiSnap = (
  doc: OrigamiDocument,
  draggedId: string,
  proposed: Vec2,
  maxSnapDistance: number,
): KawasakiSnapResult | null => {
  const adjacency = adjacencyMap(doc);
  const incident = adjacency.get(draggedId) ?? [];
  if (incident.length === 0) return null;

  const base = moveVertex(doc, draggedId, proposed);
  const vertices = vertexMap(base);

  const analyzable = (vid: string): boolean => {
    const v = vertices.get(vid);
    if (!v) return false;
    if (isOnPaperBoundary(base.paper, v)) return false;
    const deg = (adjacency.get(vid) ?? []).length;
    return deg >= 2 && deg % 2 === 0;
  };

  // Two position degrees of freedom can generally zero only one Kawasaki
  // residual, so pick the natural target: the dragged vertex itself when it
  // is analyzable, otherwise the interior vertices its creases point at
  // (dragging a leaf endpoint to repair its interior neighbor). If the
  // target set is over-constrained the descent simply fails to converge and
  // we return null — no snap rather than a wrong snap.
  let interiorAffected: string[];
  if (analyzable(draggedId)) {
    interiorAffected = [draggedId];
  } else {
    const neighbors = new Set<string>();
    for (const crease of incident) neighbors.add(otherEndpoint(crease, draggedId));
    interiorAffected = [...neighbors].filter(analyzable);
  }
  if (interiorAffected.length === 0) return null;

  const residualAt = (pos: Vec2): number => {
    const moved = moveVertex(base, draggedId, pos);
    const movedVertices = vertexMap(moved);
    let sumSq = 0;
    for (const vid of interiorAffected) {
      const v = movedVertices.get(vid);
      if (!v) continue;
      const k = analyzeKawasaki(v, adjacency.get(vid) ?? [], movedVertices, true);
      sumSq += k.errorRadians * k.errorRadians;
    }
    return sumSq;
  };

  let current = { ...proposed };
  let currentErr = residualAt(current);
  if (Math.sqrt(currentErr) <= FOLDABILITY_ANGLE_TOLERANCE) {
    // Already valid at the proposed position — nothing to snap.
    return null;
  }

  // Damped gradient descent with finite differences.
  const h = 1e-3;
  let step = maxSnapDistance / 2;
  for (let iter = 0; iter < 40 && step > 1e-7; iter++) {
    const gx =
      (residualAt({ x: current.x + h, y: current.y }) -
        residualAt({ x: current.x - h, y: current.y })) /
      (2 * h);
    const gy =
      (residualAt({ x: current.x, y: current.y + h }) -
        residualAt({ x: current.x, y: current.y - h })) /
      (2 * h);
    const norm = Math.hypot(gx, gy);
    if (norm < 1e-12) break;

    const candidate = {
      x: current.x - (gx / norm) * step,
      y: current.y - (gy / norm) * step,
    };
    const candidateErr = residualAt(candidate);
    if (candidateErr < currentErr) {
      current = candidate;
      currentErr = candidateErr;
      if (Math.sqrt(currentErr) <= FOLDABILITY_ANGLE_TOLERANCE / 4) break;
    } else {
      step /= 2;
    }
  }

  const residual = Math.sqrt(currentErr);
  if (residual > FOLDABILITY_ANGLE_TOLERANCE) return null;
  const dist = Math.hypot(current.x - proposed.x, current.y - proposed.y);
  if (dist > maxSnapDistance) return null;

  return { position: current, residual, affectedVertexIds: interiorAffected };
};
