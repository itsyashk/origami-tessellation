/**
 * Planarization: make the crease graph incidence-complete.
 *
 * Two rules, applied until neither fires:
 *
 *  1. A vertex lying on the interior of a crease splits that crease through
 *     itself (T-junctions, pass-through vertices).
 *  2. Two creases crossing at interior points get a new vertex at the
 *     crossing, splitting one of them — rule 1 then splits the other
 *     through the same vertex on the next pass.
 *
 * The result is a document where creases only meet at shared vertices, so
 * vertex analysis (Kawasaki/Maekawa) sees every incidence. Collinear
 * overlapping creases are left alone (no unique intersection point).
 *
 * Pure and idempotent: returns the SAME document reference when nothing
 * needs splitting, so callers can cheaply detect "no change".
 *
 * Cost is O(E·(V + E)) per split with a full rescan after each one — fine at
 * editor scales (splits only happen at commit points, never per pointer
 * frame). For thousand-crease tessellations, switch to a segment sweep.
 */

import { distance } from "@/geometry/vec2";
import {
  closestParamOnSegment,
  distanceToSegment,
  segmentIntersection,
} from "@/geometry/segment";
import {
  findVertexAt,
  splitCreaseAt,
  splitCreaseWithVertex,
  vertexMap,
  type OrigamiDocument,
} from "./model";

/**
 * How close (paper units) geometry must be to count as touching. Matches
 * the merge tolerance used by tiling; far below any snap distance, so only
 * genuinely coincident geometry fuses.
 */
export const INCIDENCE_EPSILON = 1e-4;

/** Apply the first split that any rule produces, or return null if planar. */
const nextSplit = (doc: OrigamiDocument): OrigamiDocument | null => {
  const vmap = vertexMap(doc);

  // Rule 1: a vertex on the interior of a crease splits it.
  for (const crease of doc.creases) {
    const a = vmap.get(crease.startVertexId);
    const b = vmap.get(crease.endVertexId);
    if (!a || !b) continue;
    const length = distance(a, b);
    if (length <= INCIDENCE_EPSILON) continue;
    for (const v of doc.vertices) {
      if (v.id === crease.startVertexId || v.id === crease.endVertexId) continue;
      if (distanceToSegment(v, a, b) > INCIDENCE_EPSILON) continue;
      const t = closestParamOnSegment(v, a, b);
      // Interior only: touches at the endpoints are already incidences.
      if (t * length <= INCIDENCE_EPSILON || (1 - t) * length <= INCIDENCE_EPSILON) {
        continue;
      }
      return splitCreaseWithVertex(doc, crease.id, v.id);
    }
  }

  // Rule 2: a proper crossing gets a vertex on one of the two creases.
  for (let i = 0; i < doc.creases.length; i++) {
    const c1 = doc.creases[i];
    const a1 = vmap.get(c1.startVertexId);
    const b1 = vmap.get(c1.endVertexId);
    if (!a1 || !b1) continue;
    const len1 = distance(a1, b1);
    if (len1 <= INCIDENCE_EPSILON) continue;

    for (let j = i + 1; j < doc.creases.length; j++) {
      const c2 = doc.creases[j];
      if (
        c1.startVertexId === c2.startVertexId ||
        c1.startVertexId === c2.endVertexId ||
        c1.endVertexId === c2.startVertexId ||
        c1.endVertexId === c2.endVertexId
      ) {
        continue; // sharing a vertex is already an incidence
      }
      const a2 = vmap.get(c2.startVertexId);
      const b2 = vmap.get(c2.endVertexId);
      if (!a2 || !b2) continue;
      const len2 = distance(a2, b2);
      if (len2 <= INCIDENCE_EPSILON) continue;

      const hit = segmentIntersection(a1, b1, a2, b2);
      if (!hit) continue;
      const interior1 =
        hit.t * len1 > INCIDENCE_EPSILON && (1 - hit.t) * len1 > INCIDENCE_EPSILON;
      const interior2 =
        hit.u * len2 > INCIDENCE_EPSILON && (1 - hit.u) * len2 > INCIDENCE_EPSILON;
      if (!interior1 || !interior2) continue; // endpoint touches → rule 1's job
      // A vertex already at the crossing means rule 1 either handled it or
      // the geometry is a degenerate duplicate-vertex stack; don't add more.
      if (findVertexAt(doc, hit.point, INCIDENCE_EPSILON)) continue;
      return splitCreaseAt(doc, c1.id, hit.point).doc;
    }
  }

  return null;
};

export const planarizeDocument = (doc: OrigamiDocument): OrigamiDocument => {
  let working = doc;
  // Each pass performs exactly one split, so the pass count is bounded by
  // the number of incidences; the guard only protects against degenerate
  // floating-point ping-pong.
  for (let guard = 0; guard < 10_000; guard++) {
    const next = nextSplit(working);
    if (next === null) return working;
    working = next;
  }
  return working;
};
