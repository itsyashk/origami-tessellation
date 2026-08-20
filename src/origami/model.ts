/**
 * The core origami document model.
 *
 * This is the single serializable source of truth for a crease pattern. It is
 * deliberately free of web/React concepts so it can be mirrored 1:1 in Swift
 * for the future native app, and mapped to/from the FOLD format later.
 *
 * All operations are pure: they take a document and return a new document.
 * Undo/redo is implemented on top of these snapshots in the state layer.
 */

import { creaseId, vertexId } from "@/lib/id";
import type { Vec2 } from "@/geometry/vec2";
import { BOUNDARY_EPSILON, POSITION_EPSILON } from "@/geometry/tolerance";

export type CreaseAssignment = "mountain" | "valley" | "unassigned" | "boundary";

export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface Crease {
  id: string;
  startVertexId: string;
  endVertexId: string;
  assignment: CreaseAssignment;
}

export interface PaperSpec {
  /** Paper spans [0, width] × [0, height] in paper units. */
  width: number;
  height: number;
}

export interface OrigamiDocument {
  /** Schema version for forward migrations. */
  version: number;
  /** Human-readable pattern name; shown in the title bar and exports. */
  name: string;
  paper: PaperSpec;
  vertices: Vertex[];
  creases: Crease[];
}

export const DOCUMENT_VERSION = 1;
export const DEFAULT_PAPER: PaperSpec = { width: 200, height: 200 };

export const emptyDocument = (name = "Untitled pattern"): OrigamiDocument => ({
  version: DOCUMENT_VERSION,
  name,
  paper: { ...DEFAULT_PAPER },
  vertices: [],
  creases: [],
});

// ---------------------------------------------------------------------------
// Lookup helpers

export const getVertex = (doc: OrigamiDocument, id: string): Vertex | undefined =>
  doc.vertices.find((v) => v.id === id);

export const getCrease = (doc: OrigamiDocument, id: string): Crease | undefined =>
  doc.creases.find((c) => c.id === id);

/** Map of vertexId → vertex, for O(1) lookups during analysis/rendering. */
export const vertexMap = (doc: OrigamiDocument): Map<string, Vertex> => {
  const map = new Map<string, Vertex>();
  for (const v of doc.vertices) map.set(v.id, v);
  return map;
};

/** Map of vertexId → creases incident to it. */
export const adjacencyMap = (doc: OrigamiDocument): Map<string, Crease[]> => {
  const map = new Map<string, Crease[]>();
  for (const c of doc.creases) {
    for (const vid of [c.startVertexId, c.endVertexId]) {
      const list = map.get(vid);
      if (list) list.push(c);
      else map.set(vid, [c]);
    }
  }
  return map;
};

export const creasesAtVertex = (doc: OrigamiDocument, vid: string): Crease[] =>
  doc.creases.filter((c) => c.startVertexId === vid || c.endVertexId === vid);

export const otherEndpoint = (crease: Crease, vid: string): string =>
  crease.startVertexId === vid ? crease.endVertexId : crease.startVertexId;

/** Find an existing vertex within `epsilon` of a position. */
export const findVertexAt = (
  doc: OrigamiDocument,
  pos: Vec2,
  epsilon = POSITION_EPSILON,
): Vertex | undefined =>
  doc.vertices.find((v) => Math.hypot(v.x - pos.x, v.y - pos.y) <= epsilon);

export const findCreaseBetween = (
  doc: OrigamiDocument,
  aId: string,
  bId: string,
): Crease | undefined =>
  doc.creases.find(
    (c) =>
      (c.startVertexId === aId && c.endVertexId === bId) ||
      (c.startVertexId === bId && c.endVertexId === aId),
  );

/**
 * Whether a position lies ON the paper boundary: inside (or within epsilon
 * of) the sheet AND within epsilon of one of its edges. Points floating
 * outside the sheet are NOT boundary points.
 */
export const isOnPaperBoundary = (
  paper: PaperSpec,
  pos: Vec2,
  epsilon = BOUNDARY_EPSILON,
): boolean => {
  const inside =
    pos.x >= -epsilon &&
    pos.x <= paper.width + epsilon &&
    pos.y >= -epsilon &&
    pos.y <= paper.height + epsilon;
  if (!inside) return false;
  return (
    Math.abs(pos.x) <= epsilon ||
    Math.abs(pos.y) <= epsilon ||
    Math.abs(pos.x - paper.width) <= epsilon ||
    Math.abs(pos.y - paper.height) <= epsilon
  );
};

export const clampToPaper = (paper: PaperSpec, pos: Vec2): Vec2 => ({
  x: Math.min(paper.width, Math.max(0, pos.x)),
  y: Math.min(paper.height, Math.max(0, pos.y)),
});

// ---------------------------------------------------------------------------
// Pure document operations

export interface AddVertexResult {
  doc: OrigamiDocument;
  vertex: Vertex;
}

export const addVertex = (
  doc: OrigamiDocument,
  pos: Vec2,
  id = vertexId(),
): AddVertexResult => {
  const vertex: Vertex = { id, x: pos.x, y: pos.y };
  return { doc: { ...doc, vertices: [...doc.vertices, vertex] }, vertex };
};

export interface AddCreaseResult {
  doc: OrigamiDocument;
  crease: Crease;
}

/**
 * Add a crease between two existing vertices. Returns the existing crease
 * unchanged if one already connects the pair (no duplicate edges).
 */
export const addCrease = (
  doc: OrigamiDocument,
  startVertexId: string,
  endVertexId: string,
  assignment: CreaseAssignment = "unassigned",
  id = creaseId(),
): AddCreaseResult => {
  if (startVertexId === endVertexId) {
    throw new Error("A crease cannot connect a vertex to itself");
  }
  if (
    !doc.vertices.some((v) => v.id === startVertexId) ||
    !doc.vertices.some((v) => v.id === endVertexId)
  ) {
    throw new Error("Crease endpoints must be existing vertices");
  }
  const existing = findCreaseBetween(doc, startVertexId, endVertexId);
  if (existing) return { doc, crease: existing };
  const crease: Crease = { id, startVertexId, endVertexId, assignment };
  return { doc: { ...doc, creases: [...doc.creases, crease] }, crease };
};

export const moveVertex = (
  doc: OrigamiDocument,
  id: string,
  pos: Vec2,
): OrigamiDocument => ({
  ...doc,
  vertices: doc.vertices.map((v) =>
    v.id === id ? { ...v, x: pos.x, y: pos.y } : v,
  ),
});

export const setCreaseAssignment = (
  doc: OrigamiDocument,
  ids: readonly string[],
  assignment: CreaseAssignment,
): OrigamiDocument => {
  const idSet = new Set(ids);
  return {
    ...doc,
    creases: doc.creases.map((c) =>
      idSet.has(c.id) ? { ...c, assignment } : c,
    ),
  };
};

/**
 * Delete vertices and creases by id. Deleting a vertex also deletes its
 * incident creases so the document never contains dangling references.
 */
export const deleteGeometry = (
  doc: OrigamiDocument,
  vertexIds: readonly string[],
  creaseIds: readonly string[] = [],
): OrigamiDocument => {
  const deadVertices = new Set(vertexIds);
  const deadCreases = new Set(creaseIds);
  return {
    ...doc,
    vertices: doc.vertices.filter((v) => !deadVertices.has(v.id)),
    creases: doc.creases.filter(
      (c) =>
        !deadCreases.has(c.id) &&
        !deadVertices.has(c.startVertexId) &&
        !deadVertices.has(c.endVertexId),
    ),
  };
};

/**
 * Assignment preference when two creases collapse onto the same pair
 * during a vertex merge. Boundary (paper edge) wins; an assigned fold
 * beats unassigned; mountain vs valley at equal rank keeps the crease
 * that already belonged to the surviving vertex.
 */
const assignmentRank = (a: CreaseAssignment): number => {
  if (a === "boundary") return 3;
  if (a === "mountain" || a === "valley") return 2;
  return 1;
};

const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

/**
 * Absorb `fromId` into `keepId`: rewire incident creases onto the survivor,
 * drop the self-loop that joined the pair, collapse duplicate edges, and
 * remove `fromId`. The kept vertex's position is unchanged — callers that
 * drag-to-merge should move `fromId` onto `keepId` first (or not: the
 * absorbed vertex's coordinates are discarded either way).
 *
 * Pure and idempotent: same ids or a missing vertex returns `doc` as-is.
 */
export const mergeVertices = (
  doc: OrigamiDocument,
  keepId: string,
  fromId: string,
): OrigamiDocument => {
  if (keepId === fromId) return doc;
  if (
    !doc.vertices.some((v) => v.id === keepId) ||
    !doc.vertices.some((v) => v.id === fromId)
  ) {
    return doc;
  }

  type Tagged = { crease: Crease; belongedToKeep: boolean };
  const byPair = new Map<string, Tagged>();

  for (const crease of doc.creases) {
    const belongedToKeep =
      crease.startVertexId === keepId || crease.endVertexId === keepId;
    const start = crease.startVertexId === fromId ? keepId : crease.startVertexId;
    const end = crease.endVertexId === fromId ? keepId : crease.endVertexId;
    if (start === end) continue; // the edge that joined keep ↔ from

    const key = pairKey(start, end);
    const candidate: Crease = { ...crease, startVertexId: start, endVertexId: end };
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, { crease: candidate, belongedToKeep });
      continue;
    }
    const incomingRank = assignmentRank(candidate.assignment);
    const existingRank = assignmentRank(existing.crease.assignment);
    if (
      incomingRank > existingRank ||
      (incomingRank === existingRank && belongedToKeep && !existing.belongedToKeep)
    ) {
      byPair.set(key, { crease: candidate, belongedToKeep });
    }
  }

  return {
    ...doc,
    vertices: doc.vertices.filter((v) => v.id !== fromId),
    creases: [...byPair.values()].map((t) => t.crease),
  };
};

/**
 * Set mixed assignments in one snapshot (one undo step). Creases not in
 * `updates` are left alone. Unknown ids are ignored.
 */
export const applyCreaseAssignments = (
  doc: OrigamiDocument,
  updates: ReadonlyArray<{ creaseId: string; assignment: CreaseAssignment }>,
): OrigamiDocument => {
  if (updates.length === 0) return doc;
  const map = new Map(updates.map((u) => [u.creaseId, u.assignment]));
  return {
    ...doc,
    creases: doc.creases.map((c) => {
      const next = map.get(c.id);
      return next !== undefined ? { ...c, assignment: next } : c;
    }),
  };
};

export interface SplitCreaseResult {
  doc: OrigamiDocument;
  vertex: Vertex;
}

/**
 * Replace a crease with two halves that pass through an existing vertex,
 * both inheriting its assignment. Halves that would duplicate an existing
 * crease are dropped rather than doubled. The vertex's position is taken as
 * given (callers put it on the segment first).
 */
export const splitCreaseWithVertex = (
  doc: OrigamiDocument,
  creaseIdToSplit: string,
  throughVertexId: string,
): OrigamiDocument => {
  const crease = getCrease(doc, creaseIdToSplit);
  if (!crease) throw new Error(`No crease ${creaseIdToSplit}`);
  if (
    throughVertexId === crease.startVertexId ||
    throughVertexId === crease.endVertexId
  ) {
    return doc;
  }
  if (!doc.vertices.some((v) => v.id === throughVertexId)) {
    throw new Error(`No vertex ${throughVertexId}`);
  }
  const remaining = doc.creases.filter((c) => c.id !== creaseIdToSplit);
  const base: OrigamiDocument = { ...doc, creases: remaining };
  const halves: Crease[] = [];
  for (const [startVertexId, endVertexId] of [
    [crease.startVertexId, throughVertexId],
    [throughVertexId, crease.endVertexId],
  ] as const) {
    if (!findCreaseBetween(base, startVertexId, endVertexId)) {
      halves.push({
        id: creaseId(),
        startVertexId,
        endVertexId,
        assignment: crease.assignment,
      });
    }
  }
  return { ...base, creases: [...remaining, ...halves] };
};

/**
 * Split a crease at a position by inserting a new vertex there.
 */
export const splitCreaseAt = (
  doc: OrigamiDocument,
  creaseIdToSplit: string,
  pos: Vec2,
  newVertexId = vertexId(),
): SplitCreaseResult => {
  if (!getCrease(doc, creaseIdToSplit)) {
    throw new Error(`No crease ${creaseIdToSplit}`);
  }
  const vertex: Vertex = { id: newVertexId, x: pos.x, y: pos.y };
  const withVertex: OrigamiDocument = {
    ...doc,
    vertices: [...doc.vertices, vertex],
  };
  return {
    doc: splitCreaseWithVertex(withVertex, creaseIdToSplit, vertex.id),
    vertex,
  };
};

/** Rename the document. */
export const renameDocument = (
  doc: OrigamiDocument,
  name: string,
): OrigamiDocument => ({ ...doc, name });

/**
 * Validate internal consistency: unique ids, crease endpoints exist, no
 * self-loops. Returns a list of human-readable problems (empty = valid).
 */
export const validateDocument = (doc: OrigamiDocument): string[] => {
  const problems: string[] = [];
  const vids = new Set<string>();
  for (const v of doc.vertices) {
    if (vids.has(v.id)) problems.push(`Duplicate vertex id: ${v.id}`);
    vids.add(v.id);
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) {
      problems.push(`Vertex ${v.id} has non-finite coordinates`);
    }
  }
  const cids = new Set<string>();
  for (const c of doc.creases) {
    if (cids.has(c.id)) problems.push(`Duplicate crease id: ${c.id}`);
    cids.add(c.id);
    if (c.startVertexId === c.endVertexId) {
      problems.push(`Crease ${c.id} is a self-loop`);
    }
    if (!vids.has(c.startVertexId) || !vids.has(c.endVertexId)) {
      problems.push(`Crease ${c.id} references a missing vertex`);
    }
  }
  return problems;
};
