/**
 * Marquee (rubber-band) selection in paper space.
 *
 * The controller converts the screen box through the viewport (y-up paper),
 * then this module returns vertices whose positions lie inside the axis-
 * aligned rectangle and creases whose both endpoints do. Pure, so tests
 * don't need a pointer.
 */

import type { Vec2 } from "@/geometry/vec2";
import { vertexMap, type OrigamiDocument } from "@/origami/model";
import { screenToPaper, type Viewport } from "./viewport";

export interface PaperRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const paperRectFromScreenBox = (
  viewport: Viewport,
  a: Vec2,
  b: Vec2,
): PaperRect => {
  const pa = screenToPaper(viewport, a);
  const pb = screenToPaper(viewport, b);
  return {
    minX: Math.min(pa.x, pb.x),
    minY: Math.min(pa.y, pb.y),
    maxX: Math.max(pa.x, pb.x),
    maxY: Math.max(pa.y, pb.y),
  };
};

const contains = (rect: PaperRect, p: Vec2): boolean =>
  p.x >= rect.minX && p.x <= rect.maxX && p.y >= rect.minY && p.y <= rect.maxY;

export const selectInPaperRect = (
  doc: OrigamiDocument,
  rect: PaperRect,
): { vertexIds: string[]; creaseIds: string[] } => {
  const vertexIds: string[] = [];
  for (const v of doc.vertices) {
    if (contains(rect, v)) vertexIds.push(v.id);
  }
  const inside = new Set(vertexIds);
  const vmap = vertexMap(doc);
  const creaseIds: string[] = [];
  for (const c of doc.creases) {
    const a = vmap.get(c.startVertexId);
    const b = vmap.get(c.endVertexId);
    if (a && b && inside.has(a.id) && inside.has(b.id)) creaseIds.push(c.id);
  }
  return { vertexIds, creaseIds };
};
