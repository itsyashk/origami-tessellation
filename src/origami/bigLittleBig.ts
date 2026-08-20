/**
 * Big-little-big lemma: a local necessary condition beyond Kawasaki/Maekawa.
 *
 * If a sector at an interior vertex is strictly smaller than both neighbors,
 * the two creases that bound it must have opposite mountain/valley assignment
 * — otherwise the small flap cannot tuck under the larger ones when folded.
 *
 * Unassigned creases are treated as free: the vertex stays quiet while some
 * completion can still satisfy every little-sector constraint, and is flagged
 * only when a completion is impossible. Generalized equal-angle runs are not
 * checked (see ORIGAMI_MATH.md).
 */

import type { Crease, CreaseAssignment } from "./model";
import type { TheoremStatus } from "./analysis";
import { ANGLE_EPSILON } from "@/geometry/tolerance";
import { radToDeg } from "@/geometry/angles";

export interface BigLittleBigAnalysis {
  status: TheoremStatus;
  /** Indices into `sectorAngles` / `sortedCreaseIds` of local-min sectors. */
  littleSectorIndices: number[];
  /** Bounding crease-id pairs that must be opposite (one per little sector). */
  constrainedPairs: [string, string][];
  explanation: string;
}

const isFold = (a: CreaseAssignment): a is "mountain" | "valley" =>
  a === "mountain" || a === "valley";

const opposite = (a: "mountain" | "valley"): "mountain" | "valley" =>
  a === "mountain" ? "valley" : "mountain";

const notApplicable = (
  reason: string,
  littleSectorIndices: number[] = [],
  constrainedPairs: [string, string][] = [],
): BigLittleBigAnalysis => ({
  status: "not-applicable",
  littleSectorIndices,
  constrainedPairs,
  explanation: reason,
});

/**
 * 2-color the constraint graph so adjacent creases get opposite M/V.
 * Precolored (already assigned) nodes are seeds. Returns false on conflict.
 */
const oppositeFoldsSatisfiable = (
  pairs: readonly [string, string][],
  assignmentOf: (id: string) => CreaseAssignment,
): boolean => {
  const adj = new Map<string, string[]>();
  const add = (a: string, b: string) => {
    const list = adj.get(a);
    if (list) list.push(b);
    else adj.set(a, [b]);
  };

  for (const [a, b] of pairs) {
    const aa = assignmentOf(a);
    const bb = assignmentOf(b);
    if (aa === "boundary" || bb === "boundary") continue;
    if (isFold(aa) && isFold(bb) && aa === bb) return false;
    add(a, b);
    add(b, a);
  }

  const color = new Map<string, "mountain" | "valley">();
  for (const id of adj.keys()) {
    const a = assignmentOf(id);
    if (isFold(a)) color.set(id, a);
  }

  const visit = (start: string): boolean => {
    if (!color.has(start)) color.set(start, "mountain");
    const stack: string[] = [start];
    while (stack.length > 0) {
      const node = stack.pop()!;
      const nodeColor = color.get(node)!;
      const want = opposite(nodeColor);
      for (const next of adj.get(node) ?? []) {
        const have = color.get(next);
        if (have === undefined) {
          color.set(next, want);
          stack.push(next);
        } else if (have !== want) {
          return false;
        }
      }
    }
    return true;
  };

  for (const id of [...color.keys()]) {
    if (!visit(id)) return false;
  }
  for (const id of adj.keys()) {
    if (color.has(id)) continue;
    if (!visit(id)) return false;
  }
  return true;
};

export const analyzeBigLittleBig = (
  creases: readonly Crease[],
  sectorAngles: readonly number[],
  sortedCreaseIds: readonly string[],
  isInterior: boolean,
): BigLittleBigAnalysis => {
  if (!isInterior) {
    return notApplicable("Big-little-big applies only to interior vertices.");
  }
  if (creases.length < 4 || creases.length % 2 !== 0) {
    return notApplicable(
      "Big-little-big applies once an interior vertex has four or more creases.",
    );
  }
  if (
    sectorAngles.length !== creases.length ||
    sortedCreaseIds.length !== creases.length
  ) {
    return notApplicable("Sector data is not available for this vertex yet.");
  }

  const n = sectorAngles.length;
  const littleSectorIndices: number[] = [];
  const constrainedPairs: [string, string][] = [];
  const byId = new Map(creases.map((c) => [c.id, c]));

  for (let i = 0; i < n; i++) {
    const prev = sectorAngles[(i - 1 + n) % n];
    const next = sectorAngles[(i + 1) % n];
    if (sectorAngles[i] < prev - ANGLE_EPSILON && sectorAngles[i] < next - ANGLE_EPSILON) {
      littleSectorIndices.push(i);
      const a = sortedCreaseIds[i];
      const b = sortedCreaseIds[(i + 1) % n];
      const ca = byId.get(a);
      const cb = byId.get(b);
      if (ca?.assignment === "boundary" || cb?.assignment === "boundary") continue;
      constrainedPairs.push([a, b]);
    }
  }

  if (littleSectorIndices.length === 0) {
    return notApplicable(
      "No sector is strictly smaller than both neighbors — big-little-big does not constrain this vertex.",
    );
  }

  const assignmentOf = (id: string): CreaseAssignment =>
    byId.get(id)?.assignment ?? "unassigned";

  const involvedUnassigned = new Set<string>();
  for (const [a, b] of constrainedPairs) {
    if (assignmentOf(a) === "unassigned") involvedUnassigned.add(a);
    if (assignmentOf(b) === "unassigned") involvedUnassigned.add(b);
  }

  const degrees = littleSectorIndices
    .map((i) => `${radToDeg(sectorAngles[i]).toFixed(1)}°`)
    .join(", ");

  if (!oppositeFoldsSatisfiable(constrainedPairs, assignmentOf)) {
    return {
      status: "invalid",
      littleSectorIndices,
      constrainedPairs,
      explanation:
        involvedUnassigned.size > 0
          ? `No assignment of the remaining creases can give opposite folds around the ${degrees} sector${littleSectorIndices.length === 1 ? "" : "s"}.`
          : `The ${degrees} sector${littleSectorIndices.length === 1 ? "" : "s"} must be bounded by opposite mountain/valley folds.`,
    };
  }

  if (involvedUnassigned.size > 0) {
    return {
      status: "not-applicable",
      littleSectorIndices,
      constrainedPairs,
      explanation: `${involvedUnassigned.size} crease${involvedUnassigned.size === 1 ? "" : "s"} still unassigned — big-little-big can still be satisfied.`,
    };
  }

  return {
    status: "valid",
    littleSectorIndices,
    constrainedPairs,
    explanation: `The ${degrees} sector${littleSectorIndices.length === 1 ? "" : "s"} ${littleSectorIndices.length === 1 ? "is" : "are"} bounded by opposite folds — big-little-big holds.`,
  };
};
