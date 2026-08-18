/**
 * Hit testing in paper coordinates with screen-calibrated tolerances.
 * Vertices win over creases when both are within range.
 */

import type { Vec2 } from "@/geometry/vec2";
import { distance } from "@/geometry/vec2";
import { distanceToSegment } from "@/geometry/segment";
import { vertexMap, type OrigamiDocument } from "@/origami/model";

export type HitTarget =
  | { type: "vertex"; id: string }
  | { type: "crease"; id: string }
  | null;

export const hitTest = (
  doc: OrigamiDocument,
  pos: Vec2,
  vertexTolerance: number,
  creaseTolerance: number,
): HitTarget => {
  let bestVertex: string | null = null;
  let bestVertexDist = vertexTolerance;
  for (const v of doc.vertices) {
    const d = distance(pos, v);
    if (d <= bestVertexDist) {
      bestVertex = v.id;
      bestVertexDist = d;
    }
  }
  if (bestVertex) return { type: "vertex", id: bestVertex };

  const vmap = vertexMap(doc);
  let bestCrease: string | null = null;
  let bestCreaseDist = creaseTolerance;
  for (const c of doc.creases) {
    const a = vmap.get(c.startVertexId);
    const b = vmap.get(c.endVertexId);
    if (!a || !b) continue;
    const d = distanceToSegment(pos, a, b);
    if (d <= bestCreaseDist) {
      bestCrease = c.id;
      bestCreaseDist = d;
    }
  }
  if (bestCrease) return { type: "crease", id: bestCrease };
  return null;
};
