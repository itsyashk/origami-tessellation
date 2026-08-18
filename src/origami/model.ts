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
import { POSITION_EPSILON } from "@/geometry/tolerance";

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

/** Whether a position lies on the paper boundary (within epsilon). */
export const isOnPaperBoundary = (
  paper: PaperSpec,
  pos: Vec2,
  epsilon = POSITION_EPSILON,
): boolean =>
  Math.abs(pos.x) <= epsilon ||
  Math.abs(pos.y) <= epsilon ||
  Math.abs(pos.x - paper.width) <= epsilon ||
  Math.abs(pos.y - paper.height) <= epsilon;

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

export interface SplitCreaseResult {
  doc: OrigamiDocument;
  vertex: Vertex;
}

/**
 * Split a crease at a position by inserting a new vertex and replacing the
 * crease with two halves that inherit its assignment. The position is used
 * as given (callers snap it onto the segment first).
 */
export const splitCreaseAt = (
  doc: OrigamiDocument,
  creaseIdToSplit: string,
  pos: Vec2,
  newVertexId = vertexId(),
): SplitCreaseResult => {
  const crease = getCrease(doc, creaseIdToSplit);
  if (!crease) throw new Error(`No crease ${creaseIdToSplit}`);
  const vertex: Vertex = { id: newVertexId, x: pos.x, y: pos.y };
  const halves: Crease[] = [
    {
      id: creaseId(),
      startVertexId: crease.startVertexId,
      endVertexId: vertex.id,
      assignment: crease.assignment,
    },
    {
      id: creaseId(),
      startVertexId: vertex.id,
      endVertexId: crease.endVertexId,
      assignment: crease.assignment,
    },
  ];
  return {
    doc: {
      ...doc,
      vertices: [...doc.vertices, vertex],
      creases: [...doc.creases.filter((c) => c.id !== creaseIdToSplit), ...halves],
    },
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
