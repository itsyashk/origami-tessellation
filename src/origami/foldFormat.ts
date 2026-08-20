/**
 * FOLD format interop (https://github.com/edemaine/fold).
 *
 * The mapping is the one the model was shaped for: vertices_coords ↔
 * vertices, edges_vertices ↔ creases, edges_assignment M/V/U/B. Faces and
 * fold angles are ignored on import (we recompute faces from the crease
 * graph). Paper size is inferred from the vertex bounding box, translated
 * so the pattern sits in the first quadrant.
 */

import {
  DOCUMENT_VERSION,
  validateDocument,
  type Crease,
  type CreaseAssignment,
  type OrigamiDocument,
  type Vertex,
} from "./model";

export interface FoldFile {
  file_spec?: number;
  file_creator?: string;
  file_classes?: string[];
  frame_classes?: string[];
  frame_title?: string;
  vertices_coords: number[][];
  edges_vertices: number[][];
  edges_assignment?: string[];
}

const TO_FOLD: Record<CreaseAssignment, string> = {
  mountain: "M",
  valley: "V",
  unassigned: "U",
  boundary: "B",
};

const FROM_FOLD: Record<string, CreaseAssignment | "skip"> = {
  M: "mountain",
  m: "mountain",
  V: "valley",
  v: "valley",
  U: "unassigned",
  u: "unassigned",
  F: "unassigned", // flat fold — not a mountain/valley
  f: "unassigned",
  B: "boundary",
  b: "boundary",
  C: "skip", // cut — not a crease
  c: "skip",
};

export const isFoldDocument = (raw: unknown): raw is FoldFile => {
  if (typeof raw !== "object" || raw === null) return false;
  const data = raw as Record<string, unknown>;
  return Array.isArray(data.vertices_coords) && Array.isArray(data.edges_vertices);
};

export const documentToFold = (doc: OrigamiDocument): FoldFile => {
  const index = new Map<string, number>();
  doc.vertices.forEach((v, i) => index.set(v.id, i));
  const edges_vertices: number[][] = [];
  const edges_assignment: string[] = [];
  for (const crease of doc.creases) {
    const a = index.get(crease.startVertexId);
    const b = index.get(crease.endVertexId);
    if (a === undefined || b === undefined) continue;
    edges_vertices.push([a, b]);
    edges_assignment.push(TO_FOLD[crease.assignment]);
  }
  return {
    file_spec: 1.1,
    file_creator: "Origami crease-pattern studio",
    file_classes: ["singleModel"],
    frame_classes: ["creasePattern"],
    frame_title: doc.name,
    vertices_coords: doc.vertices.map((v) => [v.x, v.y]),
    edges_vertices,
    edges_assignment,
  };
};

export const serializeFold = (doc: OrigamiDocument): string =>
  JSON.stringify(documentToFold(doc), null, 2);

export const foldToDocument = (raw: FoldFile): OrigamiDocument => {
  const coords = raw.vertices_coords;
  if (coords.length === 0) {
    throw new Error("FOLD file has no vertices.");
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < coords.length; i++) {
    const pair = coords[i];
    if (!Array.isArray(pair) || pair.length < 2) {
      throw new Error(`FOLD vertex ${i} is not a coordinate pair.`);
    }
    const x = pair[0];
    const y = pair[1];
    if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`FOLD vertex ${i} has non-finite coordinates.`);
    }
    points.push({ x, y });
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  // Sit the pattern in the first quadrant. A bbox already at the origin is
  // left alone so round-trips of our own files don't translate.
  const originX = minX < -1e-9 ? minX : minX > 1e-6 ? minX : 0;
  const originY = minY < -1e-9 ? minY : minY > 1e-6 ? minY : 0;
  const width = Math.max(maxX - originX, 1);
  const height = Math.max(maxY - originY, 1);

  const vertices: Vertex[] = points.map((p, i) => ({
    id: `fold_v${i}`,
    x: p.x - originX,
    y: p.y - originY,
  }));

  const assignments = raw.edges_assignment ?? [];
  const creases: Crease[] = [];
  for (let i = 0; i < raw.edges_vertices.length; i++) {
    const edge = raw.edges_vertices[i];
    if (!Array.isArray(edge) || edge.length < 2) {
      throw new Error(`FOLD edge ${i} is not a vertex-index pair.`);
    }
    const a = edge[0];
    const b = edge[1];
    if (
      typeof a !== "number" ||
      typeof b !== "number" ||
      !Number.isInteger(a) ||
      !Number.isInteger(b) ||
      a < 0 ||
      b < 0 ||
      a >= vertices.length ||
      b >= vertices.length
    ) {
      throw new Error(`FOLD edge ${i} references a missing vertex.`);
    }
    if (a === b) continue;
    const letter = assignments[i] ?? "U";
    const mapped = FROM_FOLD[letter] ?? "unassigned";
    if (mapped === "skip") continue;
    creases.push({
      id: `fold_e${i}`,
      startVertexId: vertices[a].id,
      endVertexId: vertices[b].id,
      assignment: mapped,
    });
  }

  const doc: OrigamiDocument = {
    version: DOCUMENT_VERSION,
    name: typeof raw.frame_title === "string" && raw.frame_title.trim()
      ? raw.frame_title
      : "Imported FOLD",
    paper: { width, height },
    vertices,
    creases,
  };
  const problems = validateDocument(doc);
  if (problems.length > 0) {
    throw new Error(`Invalid FOLD document: ${problems.join("; ")}`);
  }
  return doc;
};
