/**
 * Local layer-order check for degree-4 vertices.
 *
 * At a degree-4 vertex that already satisfies Kawasaki, a unique strictly
 * smallest sector determines a unique local stacking: that sector tucks
 * under its two neighbors. Global layer ordering of a whole crease pattern
 * is NP-hard and is not attempted here.
 *
 * Status is `valid` only when the local order is determined and consistent
 * with the assignment (the little sector's bounding creases opposite).
 */

import type { Crease } from "./model";
import type { TheoremStatus } from "./analysis";
import { ANGLE_EPSILON } from "@/geometry/tolerance";
import { radToDeg } from "@/geometry/angles";

export interface LayerOrderAnalysis {
  status: TheoremStatus;
  /** Index of the unique smallest sector, if one exists. */
  littleSectorIndex: number | null;
  /** Crease opposite the little sector — it covers the tucked pair. */
  coveringCreaseId: string | null;
  explanation: string;
}

const notApplicable = (
  reason: string,
  littleSectorIndex: number | null = null,
  coveringCreaseId: string | null = null,
): LayerOrderAnalysis => ({
  status: "not-applicable",
  littleSectorIndex,
  coveringCreaseId,
  explanation: reason,
});

export const analyzeLayerOrder = (
  creases: readonly Crease[],
  sectorAngles: readonly number[],
  sortedCreaseIds: readonly string[],
  isInterior: boolean,
): LayerOrderAnalysis => {
  if (!isInterior) {
    return notApplicable("Local layer order is decided only at interior vertices.");
  }
  if (creases.length !== 4 || sectorAngles.length !== 4 || sortedCreaseIds.length !== 4) {
    return notApplicable(
      "Local layer order is decided only at degree-4 vertices — higher-degree stacking is not unique from local information.",
    );
  }

  let little = 0;
  for (let i = 1; i < 4; i++) {
    if (sectorAngles[i] < sectorAngles[little] - ANGLE_EPSILON) little = i;
  }
  const unique =
    sectorAngles.filter(
      (s, i) => i !== little && Math.abs(s - sectorAngles[little]) <= ANGLE_EPSILON,
    ).length === 0;

  if (!unique) {
    return notApplicable(
      "No unique smallest sector — local layer order is not determined by this vertex alone.",
    );
  }

  const coveringCreaseId = sortedCreaseIds[(little + 2) % 4];
  const aId = sortedCreaseIds[little];
  const bId = sortedCreaseIds[(little + 1) % 4];
  const byId = new Map(creases.map((c) => [c.id, c]));
  const a = byId.get(aId)?.assignment;
  const b = byId.get(bId)?.assignment;
  const angle = `${radToDeg(sectorAngles[little]).toFixed(1)}°`;

  if (a === "unassigned" || b === "unassigned") {
    return {
      status: "not-applicable",
      littleSectorIndex: little,
      coveringCreaseId,
      explanation: `The ${angle} sector would tuck under its neighbors once its bounding creases are assigned opposite folds.`,
    };
  }

  if (
    (a === "mountain" || a === "valley") &&
    (b === "mountain" || b === "valley") &&
    a === b
  ) {
    return {
      status: "invalid",
      littleSectorIndex: little,
      coveringCreaseId,
      explanation: `The ${angle} sector cannot tuck — both bounding creases are ${a}s, so the flaps collide locally.`,
    };
  }

  if (a === "boundary" || b === "boundary") {
    return notApplicable(
      "A paper-boundary edge at this vertex is not a fold, so local stacking is not decided.",
      little,
      coveringCreaseId,
    );
  }

  return {
    status: "valid",
    littleSectorIndex: little,
    coveringCreaseId,
    explanation: `The ${angle} sector tucks under its neighbors — local layer order at this degree-4 vertex is determined.`,
  };
};
