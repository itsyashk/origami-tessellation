/**
 * Face extraction: partition the sheet into the polygonal faces bounded by
 * creases and the paper edge. This is the geometric substrate for folding —
 * a flat-fold moves faces rigidly, creasing only along their shared edges.
 *
 * Standard planar-subdivision traversal: at each vertex, outgoing edges are
 * sorted by angle; walking "next-clockwise from the reversed incoming edge"
 * traces every face loop once. Interior faces come out counter-clockwise
 * (positive area, y-up coords); the outer face is clockwise and discarded.
 *
 * Assumes the document is planarized (creases only meet at shared vertices),
 * which the editor guarantees at every commit point. Dangling creases trace
 * as zero-width slits inside their containing face and fold with it.
 */

import type { Vec2 } from "@/geometry/vec2";
import { distance } from "@/geometry/vec2";
import { normalizeAngle } from "@/geometry/angles";
import {
  findCreaseBetween,
  findVertexAt,
  isOnPaperBoundary,
  type CreaseAssignment,
  type OrigamiDocument,
} from "./model";

export interface Face {
  index: number;
  /** CCW vertex loop (ids into `positions`; may repeat around slits). */
  vertexIds: string[];
  polygon: Vec2[];
  area: number;
  centroid: Vec2;
}

/** A crease shared by two interior faces — a hinge in the fold model. */
export interface FaceAdjacency {
  faceA: number;
  faceB: number;
  a: Vec2;
  b: Vec2;
  assignment: CreaseAssignment;
  creaseId: string;
}

export interface FaceGraph {
  faces: Face[];
  adjacencies: FaceAdjacency[];
  positions: Map<string, Vec2>;
}

interface GraphEdge {
  a: string;
  b: string;
  creaseId: string | null;
  assignment: CreaseAssignment;
}

const EPS = 1e-4;

const shoelace = (polygon: Vec2[]): number => {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % polygon.length];
    sum += p.x * q.y - q.x * p.y;
  }
  return sum / 2;
};

/** Position along the paper perimeter, CCW from the origin corner. */
const perimeterParam = (paper: { width: number; height: number }, p: Vec2): number => {
  const { width: w, height: h } = paper;
  if (Math.abs(p.y) <= EPS && p.x < w - EPS) return p.x;
  if (Math.abs(p.x - w) <= EPS && p.y < h - EPS) return w + p.y;
  if (Math.abs(p.y - h) <= EPS && p.x > EPS) return w + h + (w - p.x);
  return 2 * w + h + (h - p.y);
};

export const extractFaces = (doc: OrigamiDocument): FaceGraph => {
  const positions = new Map<string, Vec2>();
  for (const v of doc.vertices) positions.set(v.id, { x: v.x, y: v.y });

  // Paper corners participate in the boundary loop; reuse coincident
  // document vertices, otherwise add synthetic ones.
  const { width: w, height: h } = doc.paper;
  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const boundaryIds = new Set<string>();
  corners.forEach((corner, i) => {
    const existing = findVertexAt(doc, corner, EPS);
    if (existing) {
      boundaryIds.add(existing.id);
    } else {
      const id = `__corner_${i}`;
      positions.set(id, corner);
      boundaryIds.add(id);
    }
  });
  for (const v of doc.vertices) {
    if (isOnPaperBoundary(doc.paper, v)) boundaryIds.add(v.id);
  }

  const edges: GraphEdge[] = [];
  for (const crease of doc.creases) {
    const a = positions.get(crease.startVertexId);
    const b = positions.get(crease.endVertexId);
    if (!a || !b || distance(a, b) <= EPS) continue;
    edges.push({
      a: crease.startVertexId,
      b: crease.endVertexId,
      creaseId: crease.id,
      assignment: crease.assignment,
    });
  }

  // Boundary edges between perimeter-consecutive boundary points, skipping
  // stretches already covered by a crease drawn along the paper edge.
  const perimeter = [...boundaryIds].sort(
    (p, q) =>
      perimeterParam(doc.paper, positions.get(p)!) -
      perimeterParam(doc.paper, positions.get(q)!),
  );
  for (let i = 0; i < perimeter.length; i++) {
    const a = perimeter[i];
    const b = perimeter[(i + 1) % perimeter.length];
    if (a === b) continue;
    if (findCreaseBetween(doc, a, b)) continue;
    edges.push({ a, b, creaseId: null, assignment: "boundary" });
  }

  // Sorted outgoing neighbors per vertex.
  const neighbors = new Map<string, { other: string; angle: number }[]>();
  const addNeighbor = (from: string, to: string) => {
    const p = positions.get(from)!;
    const q = positions.get(to)!;
    const list = neighbors.get(from) ?? [];
    list.push({ other: to, angle: normalizeAngle(Math.atan2(q.y - p.y, q.x - p.x)) });
    neighbors.set(from, list);
  };
  for (const edge of edges) {
    addNeighbor(edge.a, edge.b);
    addNeighbor(edge.b, edge.a);
  }
  for (const list of neighbors.values()) list.sort((p, q) => p.angle - q.angle);

  /** Next half-edge of the face: clockwise-next neighbor from the reversal. */
  const nextHalfEdge = (u: string, v: string): [string, string] => {
    const list = neighbors.get(v)!;
    if (list.length === 1) return [v, list[0].other]; // dead end: double back
    const p = positions.get(v)!;
    const q = positions.get(u)!;
    const back = normalizeAngle(Math.atan2(q.y - p.y, q.x - p.x));
    // Largest angle strictly below the back-direction (cyclic wrap).
    let candidate = -1;
    for (let i = 0; i < list.length; i++) {
      if (list[i].angle < back - 1e-12 && (candidate < 0 || list[i].angle > list[candidate].angle)) {
        candidate = i;
      }
    }
    if (candidate < 0) {
      let max = 0;
      for (let i = 1; i < list.length; i++) {
        if (list[i].angle > list[max].angle) max = i;
      }
      candidate = max;
    }
    return [v, list[candidate].other];
  };

  const halfEdgeFace = new Map<string, number>();
  const faces: Face[] = [];
  const visited = new Set<string>();
  const key = (u: string, v: string) => `${u}|${v}`;

  for (const edge of edges) {
    for (const [startU, startV] of [
      [edge.a, edge.b],
      [edge.b, edge.a],
    ] as const) {
      if (visited.has(key(startU, startV))) continue;
      const loop: string[] = [];
      const loopKeys: string[] = [];
      let u = startU;
      let v = startV;
      for (let guard = 0; guard < 100_000; guard++) {
        visited.add(key(u, v));
        loopKeys.push(key(u, v));
        loop.push(u);
        [u, v] = nextHalfEdge(u, v);
        if (u === startU && v === startV) break;
      }
      const polygon = loop.map((id) => positions.get(id)!);
      const area = shoelace(polygon);
      if (area <= EPS * EPS) continue; // outer face / degenerate slit
      const index = faces.length;
      for (const k of loopKeys) halfEdgeFace.set(k, index);
      let cx = 0;
      let cy = 0;
      for (const p of polygon) {
        cx += p.x;
        cy += p.y;
      }
      faces.push({
        index,
        vertexIds: loop,
        polygon,
        area,
        centroid: { x: cx / loop.length, y: cy / loop.length },
      });
    }
  }

  const adjacencies: FaceAdjacency[] = [];
  for (const edge of edges) {
    if (!edge.creaseId) continue;
    const faceA = halfEdgeFace.get(key(edge.a, edge.b));
    const faceB = halfEdgeFace.get(key(edge.b, edge.a));
    if (faceA === undefined || faceB === undefined || faceA === faceB) continue;
    adjacencies.push({
      faceA,
      faceB,
      a: positions.get(edge.a)!,
      b: positions.get(edge.b)!,
      assignment: edge.assignment,
      creaseId: edge.creaseId,
    });
  }

  return { faces, adjacencies, positions };
};
