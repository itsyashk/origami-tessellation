/**
 * Live construction symmetry: 2-fold / 4-fold rotation and axial mirrors
 * about the paper centre.
 *
 * Session-only — copies are baked into the vertex/crease arrays, so the
 * document model stays serializable and Swift-portable. Enabling a mode
 * is idempotent on a pattern that already has the symmetry (the square
 * twist under 4-fold adds nothing). Per-edit helpers orbit only the
 * geometry that just changed, so tiling then placing a vertex does not
 * re-copy the whole tessellation.
 */

import { distance, rotateAround, type Vec2 } from "@/geometry/vec2";
import {
  addCrease,
  addVertex,
  applyCreaseAssignments,
  clampToPaper,
  deleteGeometry,
  findCreaseBetween,
  findVertexAt,
  getVertex,
  setCreaseAssignment,
  type CreaseAssignment,
  type OrigamiDocument,
  type PaperSpec,
} from "./model";
import { INCIDENCE_EPSILON, planarizeDocument } from "./planarize";

export type SymmetryKind = "c2" | "c4" | "mx" | "my";
export type SymmetryMode = SymmetryKind | "off";

export interface SymmetrySpec {
  kind: SymmetryKind;
  center: Vec2;
}

export const SYMMETRY_LABELS: Record<SymmetryKind, string> = {
  c2: "2-fold",
  c4: "4-fold",
  mx: "Flip left–right",
  my: "Flip up–down",
};

export const paperCenter = (paper: PaperSpec): Vec2 => ({
  x: paper.width / 2,
  y: paper.height / 2,
});

export const specFromKind = (
  kind: SymmetryMode,
  paper: PaperSpec,
): SymmetrySpec | null =>
  kind === "off" ? null : { kind, center: paperCenter(paper) };

/** Identity plus the non-trivial copies for this group, in order. */
export const orbitTransforms = (spec: SymmetrySpec): ((p: Vec2) => Vec2)[] => {
  const { center: c, kind } = spec;
  switch (kind) {
    case "c2":
      return [(p) => p, (p) => rotateAround(p, c, Math.PI)];
    case "c4":
      return [
        (p) => p,
        (p) => rotateAround(p, c, Math.PI / 2),
        (p) => rotateAround(p, c, Math.PI),
        (p) => rotateAround(p, c, (3 * Math.PI) / 2),
      ];
    case "mx":
      return [(p) => p, (p) => ({ x: 2 * c.x - p.x, y: p.y })];
    case "my":
      return [(p) => p, (p) => ({ x: p.x, y: 2 * c.y - p.y })];
  }
};

export const orbitPoints = (p: Vec2, spec: SymmetrySpec): Vec2[] =>
  orbitTransforms(spec).map((t) => t(p));

const vertexAt = (doc: OrigamiDocument, pos: Vec2) =>
  findVertexAt(doc, pos, INCIDENCE_EPSILON);

/** Add missing images of one vertex. Same document reference if complete. */
export const ensureVertexOrbit = (
  doc: OrigamiDocument,
  vertexId: string,
  spec: SymmetrySpec,
): OrigamiDocument => {
  const v = getVertex(doc, vertexId);
  if (!v) return doc;
  const images = orbitTransforms(spec).slice(1);
  let next = doc;
  for (const t of images) {
    const pos = clampToPaper(next.paper, t(v));
    if (vertexAt(next, pos)) continue;
    next = addVertex(next, pos).doc;
  }
  return next;
};

/** Add missing images of one crease (and its endpoints). Same ref if complete. */
export const ensureCreaseOrbit = (
  doc: OrigamiDocument,
  creaseId: string,
  spec: SymmetrySpec,
): OrigamiDocument => {
  const crease = doc.creases.find((c) => c.id === creaseId);
  if (!crease) return doc;
  let next = ensureVertexOrbit(doc, crease.startVertexId, spec);
  next = ensureVertexOrbit(next, crease.endVertexId, spec);
  const a = getVertex(next, crease.startVertexId);
  const b = getVertex(next, crease.endVertexId);
  if (!a || !b) return next;
  const images = orbitTransforms(spec).slice(1);
  for (const t of images) {
    const aV = vertexAt(next, clampToPaper(next.paper, t(a)));
    const bV = vertexAt(next, clampToPaper(next.paper, t(b)));
    if (!aV || !bV || aV.id === bV.id) continue;
    if (findCreaseBetween(next, aV.id, bV.id)) continue;
    next = addCrease(next, aV.id, bV.id, crease.assignment).doc;
  }
  return next;
};

/**
 * Ensure every vertex and crease has its full orbit, reusing coincident
 * vertices. Returns the same document reference when already complete.
 */
export const completeSymmetry = (
  doc: OrigamiDocument,
  spec: SymmetrySpec,
): OrigamiDocument => {
  const vertexIds = doc.vertices.map((v) => v.id);
  const creaseIds = doc.creases.map((c) => c.id);
  let next = doc;
  for (const id of vertexIds) next = ensureVertexOrbit(next, id, spec);
  for (const id of creaseIds) next = ensureCreaseOrbit(next, id, spec);
  return next;
};

/** Fill missing copies then planarize. Same reference when nothing to do. */
export const documentWithSymmetry = (
  doc: OrigamiDocument,
  kind: SymmetryMode,
): OrigamiDocument => {
  const spec = specFromKind(kind, doc.paper);
  if (!spec) return doc;
  return planarizeDocument(completeSymmetry(doc, spec));
};

/** Vertex ids occupying the orbit of `vertexId` (including itself). */
export const orbitVertexIds = (
  doc: OrigamiDocument,
  vertexId: string,
  spec: SymmetrySpec,
): string[] => {
  const v = getVertex(doc, vertexId);
  if (!v) return [];
  const ids: string[] = [];
  for (const pos of orbitPoints(v, spec)) {
    const hit = vertexAt(doc, pos);
    if (hit && !ids.includes(hit.id)) ids.push(hit.id);
  }
  return ids;
};

/**
 * Move `vertexId` to `newPos` and every orbit copy to the matching image.
 * Positions update simultaneously so a 180° swap does not collapse the pair.
 * Missing copies are created (a drag in a freshly enabled mode still
 * carries the group).
 */
export const moveOrbit = (
  doc: OrigamiDocument,
  vertexId: string,
  newPos: Vec2,
  spec: SymmetrySpec,
): OrigamiDocument => {
  const v = getVertex(doc, vertexId);
  if (!v) return doc;
  const transforms = orbitTransforms(spec);
  const oldImages = transforms.map((t) => t(v));
  const newImages = transforms.map((t) => clampToPaper(doc.paper, t(newPos)));

  const planned = new Map<string, Vec2>();
  const toCreate: Vec2[] = [];
  for (let i = 0; i < transforms.length; i++) {
    const occupant = vertexAt(doc, oldImages[i]);
    if (!occupant) {
      toCreate.push(newImages[i]);
      continue;
    }
    if (!planned.has(occupant.id)) {
      planned.set(occupant.id, newImages[i]);
      continue;
    }
    const already = planned.get(occupant.id);
    if (already && distance(already, newImages[i]) > INCIDENCE_EPSILON) {
      toCreate.push(newImages[i]);
    }
  }

  let next: OrigamiDocument = {
    ...doc,
    vertices: doc.vertices.map((vert) => {
      const pos = planned.get(vert.id);
      return pos ? { ...vert, x: pos.x, y: pos.y } : vert;
    }),
  };
  for (const pos of toCreate) {
    if (vertexAt(next, pos)) continue;
    next = addVertex(next, pos).doc;
  }
  return next;
};

export const deleteOrbit = (
  doc: OrigamiDocument,
  vertexIds: readonly string[],
  creaseIds: readonly string[],
  spec: SymmetrySpec,
): OrigamiDocument => {
  const deadV = new Set(vertexIds);
  for (const id of vertexIds) {
    for (const oid of orbitVertexIds(doc, id, spec)) deadV.add(oid);
  }
  const deadC = new Set(creaseIds);
  const transforms = orbitTransforms(spec).slice(1);
  for (const cid of creaseIds) {
    const crease = doc.creases.find((c) => c.id === cid);
    if (!crease) continue;
    const a = getVertex(doc, crease.startVertexId);
    const b = getVertex(doc, crease.endVertexId);
    if (!a || !b) continue;
    for (const t of transforms) {
      const aV = vertexAt(doc, t(a));
      const bV = vertexAt(doc, t(b));
      if (!aV || !bV) continue;
      const copy = findCreaseBetween(doc, aV.id, bV.id);
      if (copy) deadC.add(copy.id);
    }
  }
  return deleteGeometry(doc, [...deadV], [...deadC]);
};

export const assignOrbit = (
  doc: OrigamiDocument,
  creaseIds: readonly string[],
  assignment: CreaseAssignment,
  spec: SymmetrySpec,
): OrigamiDocument => {
  const ids = new Set(creaseIds);
  const transforms = orbitTransforms(spec).slice(1);
  for (const cid of creaseIds) {
    const crease = doc.creases.find((c) => c.id === cid);
    if (!crease) continue;
    const a = getVertex(doc, crease.startVertexId);
    const b = getVertex(doc, crease.endVertexId);
    if (!a || !b) continue;
    for (const t of transforms) {
      const aV = vertexAt(doc, t(a));
      const bV = vertexAt(doc, t(b));
      if (!aV || !bV) continue;
      const copy = findCreaseBetween(doc, aV.id, bV.id);
      if (copy) ids.add(copy.id);
    }
  }
  return setCreaseAssignment(doc, [...ids], assignment);
};

export const applyAssignmentsWithOrbit = (
  doc: OrigamiDocument,
  updates: ReadonlyArray<{ creaseId: string; assignment: CreaseAssignment }>,
  spec: SymmetrySpec | null,
): OrigamiDocument => {
  let next = applyCreaseAssignments(doc, updates);
  if (!spec) return next;
  for (const update of updates) {
    next = assignOrbit(next, [update.creaseId], update.assignment, spec);
  }
  return next;
};
