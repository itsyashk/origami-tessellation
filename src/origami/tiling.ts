/**
 * Motif repetition: tile a selected portion of the pattern (or the whole
 * pattern) in a rows × columns grid — the seed of real tessellation support.
 *
 * Copies are translated by the motif's bounding box (plus optional gap),
 * coincident vertices are merged, and the paper grows to fit. Pure function;
 * the caller decides how to commit the result.
 */

import { vertexId, creaseId } from "@/lib/id";
import {
  findVertexAt,
  type Crease,
  type OrigamiDocument,
  type Vertex,
} from "./model";

export interface TileOptions {
  rows: number;
  columns: number;
  /** Extra spacing between tiles in paper units (default 0: edge-to-edge). */
  gap?: number;
  /** Vertex ids forming the motif; empty/omitted = the whole document. */
  motifVertexIds?: readonly string[];
}

const MERGE_EPSILON = 1e-4;

export const tileMotif = (
  doc: OrigamiDocument,
  options: TileOptions,
): OrigamiDocument => {
  const { rows, columns, gap = 0 } = options;
  if (rows < 1 || columns < 1 || (rows === 1 && columns === 1)) return doc;

  const motifIds =
    options.motifVertexIds && options.motifVertexIds.length > 0
      ? new Set(options.motifVertexIds)
      : new Set(doc.vertices.map((v) => v.id));

  const motifVertices = doc.vertices.filter((v) => motifIds.has(v.id));
  if (motifVertices.length === 0) return doc;
  const motifCreases = doc.creases.filter(
    (c) => motifIds.has(c.startVertexId) && motifIds.has(c.endVertexId),
  );

  const minX = Math.min(...motifVertices.map((v) => v.x));
  const maxX = Math.max(...motifVertices.map((v) => v.x));
  const minY = Math.min(...motifVertices.map((v) => v.y));
  const maxY = Math.max(...motifVertices.map((v) => v.y));
  const strideX = maxX - minX + gap;
  const strideY = maxY - minY + gap;
  if (strideX <= 0 && strideY <= 0) return doc;

  let result: OrigamiDocument = {
    ...doc,
    vertices: [...doc.vertices],
    creases: [...doc.creases],
  };

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      if (row === 0 && col === 0) continue; // the original motif
      const dx = col * strideX;
      const dy = row * strideY;

      // Map motif vertex id → vertex id in this tile (reusing merged ones).
      const idMap = new Map<string, string>();
      const newVertices: Vertex[] = [];
      for (const v of motifVertices) {
        const pos = { x: v.x + dx, y: v.y + dy };
        const existing = findVertexAt(result, pos, MERGE_EPSILON);
        if (existing) {
          idMap.set(v.id, existing.id);
        } else {
          const copy: Vertex = { id: vertexId(), x: pos.x, y: pos.y };
          idMap.set(v.id, copy.id);
          newVertices.push(copy);
        }
      }
      result = { ...result, vertices: [...result.vertices, ...newVertices] };

      const newCreases: Crease[] = [];
      for (const c of motifCreases) {
        const startId = idMap.get(c.startVertexId)!;
        const endId = idMap.get(c.endVertexId)!;
        const duplicate = result.creases.some(
          (existing) =>
            (existing.startVertexId === startId && existing.endVertexId === endId) ||
            (existing.startVertexId === endId && existing.endVertexId === startId),
        );
        if (duplicate) continue;
        newCreases.push({
          id: creaseId(),
          startVertexId: startId,
          endVertexId: endId,
          assignment: c.assignment,
        });
      }
      result = { ...result, creases: [...result.creases, ...newCreases] };
    }
  }

  // Grow the paper to contain the tiled pattern.
  const allX = result.vertices.map((v) => v.x);
  const allY = result.vertices.map((v) => v.y);
  const width = Math.max(result.paper.width, Math.ceil(Math.max(...allX)));
  const height = Math.max(result.paper.height, Math.ceil(Math.max(...allY)));
  return { ...result, paper: { width, height } };
};
