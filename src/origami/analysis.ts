/**
 * Live mathematical analysis of a crease pattern.
 *
 * Every result is structured — validity, numerical error, expected vs actual
 * values, affected geometry, and a human-readable explanation — so the same
 * analysis can power inline feedback, inspector panels, snapping, tutorials,
 * and future solvers. Nothing here touches React or the DOM.
 */

import {
  adjacencyMap,
  isOnPaperBoundary,
  otherEndpoint,
  vertexMap,
  type Crease,
  type OrigamiDocument,
  type Vertex,
} from "./model";
import { normalizeAngle, radToDeg, sectorAnglesFromRays } from "@/geometry/angles";
import {
  FOLDABILITY_ANGLE_TOLERANCE,
  FOLDABILITY_NEAR_TOLERANCE,
} from "@/geometry/tolerance";

export type TheoremStatus =
  | "valid" //     satisfied within tolerance
  | "near" //      almost satisfied — worth showing the residual and offering a snap
  | "invalid" //   clearly violated
  | "not-applicable"; // boundary vertex, isolated vertex, or missing data

export interface KawasakiAnalysis {
  status: TheoremStatus;
  /**
   * Signed residual in radians: (sum of odd sectors) − π.
   * Zero exactly when Kawasaki's theorem holds.
   */
  errorRadians: number;
  errorDegrees: number;
  /** Alternating sums, each expected to be π for a flat-foldable vertex. */
  oddSectorSum: number;
  evenSectorSum: number;
  expectedSum: number;
  /** Sector angles in CCW order (radians), aligned with `sortedCreaseIds`. */
  sectorAngles: number[];
  /** Crease ids sorted by outgoing angle; sector[i] lies after crease[i]. */
  sortedCreaseIds: string[];
  explanation: string;
}

export interface MaekawaAnalysis {
  status: TheoremStatus;
  mountains: number;
  valleys: number;
  unassigned: number;
  /** mountains − valleys. */
  difference: number;
  /** ±2 for an interior flat-foldable vertex. */
  expectedDifference: 2 | -2 | null;
  explanation: string;
}

export interface VertexAnalysis {
  vertexId: string;
  degree: number;
  /** Interior vertices are subject to Kawasaki/Maekawa; boundary ones are not. */
  isInterior: boolean;
  kawasaki: KawasakiAnalysis;
  maekawa: MaekawaAnalysis;
  /**
   * True when every applicable local condition holds. This is a convenience
   * roll-up; consumers needing detail should read the individual analyses.
   */
  locallyFlatFoldable: boolean;
}

export interface DocumentAnalysis {
  byVertex: Map<string, VertexAnalysis>;
  interiorVertexCount: number;
  validVertexCount: number;
  invalidVertexCount: number;
  nearVertexCount: number;
}

const notApplicable = (reason: string): KawasakiAnalysis => ({
  status: "not-applicable",
  errorRadians: 0,
  errorDegrees: 0,
  oddSectorSum: 0,
  evenSectorSum: 0,
  expectedSum: Math.PI,
  sectorAngles: [],
  sortedCreaseIds: [],
  explanation: reason,
});

/** Outgoing crease angles from a vertex, paired with crease ids. */
export const outgoingCreaseAngles = (
  vertex: Vertex,
  creases: readonly Crease[],
  vertices: Map<string, Vertex>,
): { creaseId: string; angle: number }[] => {
  const result: { creaseId: string; angle: number }[] = [];
  for (const crease of creases) {
    const other = vertices.get(otherEndpoint(crease, vertex.id));
    if (!other) continue;
    result.push({
      creaseId: crease.id,
      angle: Math.atan2(other.y - vertex.y, other.x - vertex.x),
    });
  }
  return result;
};

export const analyzeKawasaki = (
  vertex: Vertex,
  creases: readonly Crease[],
  vertices: Map<string, Vertex>,
  isInterior: boolean,
): KawasakiAnalysis => {
  if (!isInterior) {
    return notApplicable("Kawasaki's theorem applies only to interior vertices.");
  }
  if (creases.length === 0) {
    return notApplicable("This vertex has no creases yet.");
  }
  if (creases.length === 1) {
    // A dangling crease end is work in progress, not a math violation.
    return notApplicable(
      "An unfinished crease end — connect it onward or move it to the paper edge.",
    );
  }
  if (creases.length % 2 !== 0) {
    const analysis = notApplicable(
      `An interior vertex needs an even number of creases to fold flat; this one has ${creases.length}.`,
    );
    return { ...analysis, status: "invalid" };
  }

  const rays = outgoingCreaseAngles(vertex, creases, vertices).map((r) => ({
    ...r,
    // Normalize to [0, 2π) so the sort order matches sectorAnglesFromRays.
    angle: normalizeAngle(r.angle),
  }));
  const sorted = [...rays].sort((a, b) => a.angle - b.angle);
  const sectorAngles = sectorAnglesFromRays(sorted.map((r) => r.angle));

  let oddSectorSum = 0;
  let evenSectorSum = 0;
  sectorAngles.forEach((sector, i) => {
    if (i % 2 === 0) oddSectorSum += sector;
    else evenSectorSum += sector;
  });

  const errorRadians = oddSectorSum - Math.PI;
  const errorDegrees = radToDeg(errorRadians);
  const abs = Math.abs(errorRadians);

  const status: TheoremStatus =
    abs <= FOLDABILITY_ANGLE_TOLERANCE
      ? "valid"
      : abs <= FOLDABILITY_NEAR_TOLERANCE
        ? "near"
        : "invalid";

  const explanation =
    status === "valid"
      ? "Alternating sector angles each sum to 180° — Kawasaki's theorem holds."
      : status === "near"
        ? `Alternating sums differ from 180° by ${Math.abs(errorDegrees).toFixed(1)}° — almost flat-foldable.`
        : `Alternating sums differ from 180° by ${Math.abs(errorDegrees).toFixed(1)}°. Move a crease so alternating sectors balance.`;

  return {
    status,
    errorRadians,
    errorDegrees,
    oddSectorSum,
    evenSectorSum,
    expectedSum: Math.PI,
    sectorAngles,
    sortedCreaseIds: sorted.map((r) => r.creaseId),
    explanation,
  };
};

export const analyzeMaekawa = (
  creases: readonly Crease[],
  isInterior: boolean,
): MaekawaAnalysis => {
  const mountains = creases.filter((c) => c.assignment === "mountain").length;
  const valleys = creases.filter((c) => c.assignment === "valley").length;
  const unassigned = creases.filter(
    (c) => c.assignment === "unassigned",
  ).length;
  const difference = mountains - valleys;

  if (!isInterior) {
    return {
      status: "not-applicable",
      mountains,
      valleys,
      unassigned,
      difference,
      expectedDifference: null,
      explanation: "Maekawa's theorem applies only to interior vertices.",
    };
  }
  if (creases.length <= 1) {
    return {
      status: "not-applicable",
      mountains,
      valleys,
      unassigned,
      difference,
      expectedDifference: null,
      explanation:
        creases.length === 0
          ? "This vertex has no creases yet."
          : "An unfinished crease end — Maekawa applies once the vertex is complete.",
    };
  }
  if (unassigned > 0) {
    // With free creases, Maekawa is satisfiable iff some assignment of the
    // remaining creases can reach ±2 (parity + range check).
    const reachable = (target: number) =>
      Math.abs(target - difference) <= unassigned &&
      (target - difference + unassigned) % 2 === 0;
    const satisfiable = reachable(2) || reachable(-2);
    return {
      status: satisfiable ? "not-applicable" : "invalid",
      mountains,
      valleys,
      unassigned,
      difference,
      expectedDifference: null,
      explanation: satisfiable
        ? `${unassigned} crease${unassigned === 1 ? "" : "s"} still unassigned — Maekawa can still be satisfied.`
        : "No assignment of the remaining creases can make mountains − valleys = ±2.",
    };
  }

  const valid = difference === 2 || difference === -2;
  return {
    status: valid ? "valid" : "invalid",
    mountains,
    valleys,
    unassigned,
    difference,
    expectedDifference: difference >= 0 ? 2 : -2,
    explanation: valid
      ? `Mountains − valleys = ${difference > 0 ? "+2" : "−2"} — Maekawa's theorem holds.`
      : `Mountains − valleys = ${difference}, but a flat-foldable interior vertex needs ±2.`,
  };
};

export const analyzeVertex = (
  doc: OrigamiDocument,
  vertex: Vertex,
  creases: readonly Crease[],
  vertices: Map<string, Vertex>,
): VertexAnalysis => {
  const isInterior = !isOnPaperBoundary(doc.paper, vertex);
  const kawasaki = analyzeKawasaki(vertex, creases, vertices, isInterior);
  const maekawa = analyzeMaekawa(creases, isInterior);
  const locallyFlatFoldable =
    !isInterior ||
    creases.length === 0 ||
    (kawasaki.status === "valid" && maekawa.status !== "invalid");
  return {
    vertexId: vertex.id,
    degree: creases.length,
    isInterior,
    kawasaki,
    maekawa,
    locallyFlatFoldable,
  };
};

/**
 * Analyze every vertex in the document. Cost is O(V + E log E); fine to run
 * on each document change at current scales. If patterns grow to thousands
 * of creases, switch to incremental re-analysis of vertices whose incident
 * creases changed (the per-vertex API above already supports that).
 */
export const analyzeDocument = (doc: OrigamiDocument): DocumentAnalysis => {
  const vertices = vertexMap(doc);
  const adjacency = adjacencyMap(doc);
  const byVertex = new Map<string, VertexAnalysis>();

  let interiorVertexCount = 0;
  let validVertexCount = 0;
  let invalidVertexCount = 0;
  let nearVertexCount = 0;

  for (const vertex of doc.vertices) {
    const creases = adjacency.get(vertex.id) ?? [];
    const analysis = analyzeVertex(doc, vertex, creases, vertices);
    byVertex.set(vertex.id, analysis);
    // Degree-1 vertices are in-progress geometry; they don't enter the tally.
    if (analysis.isInterior && analysis.degree >= 2) {
      interiorVertexCount++;
      const k = analysis.kawasaki.status;
      const m = analysis.maekawa.status;
      if (k === "invalid" || m === "invalid") invalidVertexCount++;
      else if (k === "near") nearVertexCount++;
      else if (k === "valid") validVertexCount++;
    }
  }

  return {
    byVertex,
    interiorVertexCount,
    validVertexCount,
    invalidVertexCount,
    nearVertexCount,
  };
};
