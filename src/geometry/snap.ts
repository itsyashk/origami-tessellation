/**
 * Snapping engine: given a raw pointer position in paper coordinates, find
 * the best mathematically meaningful position nearby.
 *
 * Pure and framework-free. The editor passes tolerances in paper units
 * (screen tolerance ÷ zoom) so snap "feel" is constant on screen at any zoom.
 */

import type { Vec2 } from "./vec2";
import { distance, fromAngle, add, sub, angleOf, length } from "./vec2";
import { closestPointOnSegment } from "./segment";
import { degToRad } from "./angles";
import type { OrigamiDocument, Vertex } from "@/origami/model";

export type SnapKind =
  | "vertex" //    onto an existing vertex
  | "on-crease" // onto the nearest point of an existing crease
  | "align" //     axis-aligned with one or two existing vertices
  | "angle" //     along a snapped angle ray from an origin vertex
  | "grid" //      onto the background grid
  | "kawasaki"; // onto a position that makes affected vertices flat-foldable

export interface SnapGuide {
  kind: "align" | "angle-ray";
  from: Vec2;
  to: Vec2;
}

export interface SnapHit {
  kind: SnapKind;
  position: Vec2;
  /** Distance from the raw pointer position, paper units. */
  distance: number;
  /** Ids of geometry that motivated the snap (for highlighting). */
  vertexIds: string[];
  creaseId?: string;
  /** Short label for inline feedback, e.g. "45°" or "Kawasaki ✓". */
  label?: string;
  guides: SnapGuide[];
}

export interface SnapOptions {
  /** Snap onto existing vertices. */
  vertices?: boolean;
  /** Ids to ignore (e.g. the dragged vertex and its own position). */
  excludeVertexIds?: readonly string[];
  /** Snap onto existing creases (point-on-segment). */
  creases?: boolean;
  excludeCreaseIds?: readonly string[];
  /** Snap to horizontal/vertical alignment with existing vertices. */
  alignments?: boolean;
  /** Grid spacing in paper units, or null to disable grid snap. */
  gridSize?: number | null;
  /** Origin for angle snapping (e.g. crease start while drawing). */
  angleOrigin?: Vec2 | null;
  /** Angle step in degrees for angle snapping. */
  angleStepDegrees?: number;
  /** Base tolerance in paper units. */
  tolerance: number;
}

const GUIDE_EXTENT = 1e4;

export const snapToVertices = (
  doc: OrigamiDocument,
  pos: Vec2,
  tolerance: number,
  exclude: ReadonlySet<string>,
): SnapHit | null => {
  let best: Vertex | null = null;
  let bestDist = tolerance;
  for (const v of doc.vertices) {
    if (exclude.has(v.id)) continue;
    const d = distance(pos, v);
    if (d <= bestDist) {
      best = v;
      bestDist = d;
    }
  }
  if (!best) return null;
  return {
    kind: "vertex",
    position: { x: best.x, y: best.y },
    distance: bestDist,
    vertexIds: [best.id],
    guides: [],
  };
};

export const snapToCreases = (
  doc: OrigamiDocument,
  pos: Vec2,
  tolerance: number,
  excludeCreases: ReadonlySet<string>,
  excludeVertices: ReadonlySet<string>,
): SnapHit | null => {
  let best: SnapHit | null = null;
  for (const c of doc.creases) {
    if (excludeCreases.has(c.id)) continue;
    if (excludeVertices.has(c.startVertexId) || excludeVertices.has(c.endVertexId))
      continue;
    const a = doc.vertices.find((v) => v.id === c.startVertexId);
    const b = doc.vertices.find((v) => v.id === c.endVertexId);
    if (!a || !b) continue;
    const point = closestPointOnSegment(pos, a, b);
    const d = distance(pos, point);
    if (d <= tolerance && (!best || d < best.distance)) {
      best = {
        kind: "on-crease",
        position: point,
        distance: d,
        vertexIds: [],
        creaseId: c.id,
        guides: [],
      };
    }
  }
  return best;
};

export const snapToAlignments = (
  doc: OrigamiDocument,
  pos: Vec2,
  tolerance: number,
  exclude: ReadonlySet<string>,
): SnapHit | null => {
  let bestX: Vertex | null = null;
  let bestXDist = tolerance;
  let bestY: Vertex | null = null;
  let bestYDist = tolerance;
  for (const v of doc.vertices) {
    if (exclude.has(v.id)) continue;
    const dx = Math.abs(v.x - pos.x);
    const dy = Math.abs(v.y - pos.y);
    if (dx <= bestXDist) {
      bestX = v;
      bestXDist = dx;
    }
    if (dy <= bestYDist) {
      bestY = v;
      bestYDist = dy;
    }
  }
  if (!bestX && !bestY) return null;

  const snapped: Vec2 = {
    x: bestX ? bestX.x : pos.x,
    y: bestY ? bestY.y : pos.y,
  };
  const guides: SnapGuide[] = [];
  const vertexIds: string[] = [];
  if (bestX) {
    vertexIds.push(bestX.id);
    guides.push({
      kind: "align",
      from: { x: bestX.x, y: Math.min(bestX.y, snapped.y) - 20 },
      to: { x: bestX.x, y: Math.max(bestX.y, snapped.y) + 20 },
    });
  }
  if (bestY) {
    vertexIds.push(bestY.id);
    guides.push({
      kind: "align",
      from: { x: Math.min(bestY.x, snapped.x) - 20, y: bestY.y },
      to: { x: Math.max(bestY.x, snapped.x) + 20, y: bestY.y },
    });
  }
  return {
    kind: "align",
    position: snapped,
    distance: distance(pos, snapped),
    vertexIds,
    guides,
  };
};

export const snapToAngle = (
  origin: Vec2,
  pos: Vec2,
  stepDegrees: number,
  tolerance: number,
): SnapHit | null => {
  const delta = sub(pos, origin);
  const radius = length(delta);
  if (radius < 1e-9) return null;
  const step = degToRad(stepDegrees);
  const raw = angleOf(delta);
  const snappedAngle = Math.round(raw / step) * step;
  const snapped = add(origin, fromAngle(snappedAngle, radius));
  const d = distance(pos, snapped);
  if (d > tolerance) return null;
  const deg = Math.round(((snappedAngle * 180) / Math.PI + 360) % 360);
  return {
    kind: "angle",
    position: snapped,
    distance: d,
    vertexIds: [],
    label: `${deg}°`,
    guides: [
      {
        kind: "angle-ray",
        from: origin,
        to: add(origin, fromAngle(snappedAngle, Math.max(radius * 1.4, 40))),
      },
    ],
  };
};

export const snapToGrid = (
  pos: Vec2,
  gridSize: number,
  tolerance: number,
): SnapHit | null => {
  const snapped = {
    x: Math.round(pos.x / gridSize) * gridSize,
    y: Math.round(pos.y / gridSize) * gridSize,
  };
  const d = distance(pos, snapped);
  if (d > tolerance) return null;
  return { kind: "grid", position: snapped, distance: d, vertexIds: [], guides: [] };
};

/** Priority order when multiple snap kinds hit (lower = stronger). */
const PRIORITY: Record<SnapKind, number> = {
  vertex: 0,
  kawasaki: 1,
  angle: 2,
  align: 3,
  "on-crease": 4,
  grid: 5,
};

/**
 * Compute the best snap for a pointer position. Returns null when nothing is
 * within tolerance — the caller then uses the raw position.
 */
export const computeSnap = (
  doc: OrigamiDocument,
  pos: Vec2,
  options: SnapOptions,
): SnapHit | null => {
  const excludeV = new Set(options.excludeVertexIds ?? []);
  const excludeC = new Set(options.excludeCreaseIds ?? []);
  const candidates: SnapHit[] = [];

  if (options.vertices) {
    // Vertex snap gets a slightly larger capture radius: landing exactly on
    // an existing vertex is almost always what the user means.
    const hit = snapToVertices(doc, pos, options.tolerance * 1.4, excludeV);
    if (hit) candidates.push(hit);
  }
  if (options.angleOrigin) {
    const hit = snapToAngle(
      options.angleOrigin,
      pos,
      options.angleStepDegrees ?? 15,
      options.tolerance,
    );
    if (hit) candidates.push(hit);
  }
  if (options.alignments) {
    const hit = snapToAlignments(doc, pos, options.tolerance, excludeV);
    if (hit) candidates.push(hit);
  }
  if (options.creases) {
    const hit = snapToCreases(doc, pos, options.tolerance, excludeC, excludeV);
    if (hit) candidates.push(hit);
  }
  if (options.gridSize) {
    const hit = snapToGrid(pos, options.gridSize, options.tolerance * 0.75);
    if (hit) candidates.push(hit);
  }

  if (candidates.length === 0) return null;
  candidates.sort(
    (a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || a.distance - b.distance,
  );
  return candidates[0];
};

export { GUIDE_EXTENT };
