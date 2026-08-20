/**
 * Given a Kawasaki-valid vertex with unassigned creases, enumerate mountain/
 * valley completions that satisfy Maekawa and big-little-big (and, at
 * degree 4, a determined local layer order).
 *
 * Combinatorial, not a global solver: at most 8 free creases (256 trials).
 * Callers present the first suggestion as an "assign to fold" action.
 */

import {
  adjacencyMap,
  isOnPaperBoundary,
  vertexMap,
  type CreaseAssignment,
  type OrigamiDocument,
} from "./model";
import { analyzeKawasaki, analyzeMaekawa } from "./analysis";
import { analyzeBigLittleBig } from "./bigLittleBig";
import { analyzeLayerOrder } from "./layerOrder";

export interface AssignmentSuggestion {
  assignments: { creaseId: string; assignment: "mountain" | "valley" }[];
  mountains: number;
  valleys: number;
  maekawaDifference: number;
  explanation: string;
}

const MAX_FREE = 8;

export const suggestAssignments = (
  doc: OrigamiDocument,
  vertexId: string,
): AssignmentSuggestion[] => {
  const vertex = doc.vertices.find((v) => v.id === vertexId);
  if (!vertex) return [];
  const vertices = vertexMap(doc);
  const creases = adjacencyMap(doc).get(vertexId) ?? [];
  const isInterior = !isOnPaperBoundary(doc.paper, vertex);
  if (!isInterior || creases.length < 2) return [];

  const kawasaki = analyzeKawasaki(vertex, creases, vertices, isInterior);
  if (kawasaki.status !== "valid") return [];

  const free = creases.filter((c) => c.assignment === "unassigned");
  if (free.length === 0 || free.length > MAX_FREE) return [];

  const results: AssignmentSuggestion[] = [];
  const n = free.length;
  const limit = 1 << n;

  for (let mask = 0; mask < limit; mask++) {
    const overlay = new Map<string, "mountain" | "valley">();
    for (let i = 0; i < n; i++) {
      overlay.set(free[i].id, mask & (1 << i) ? "mountain" : "valley");
    }
    const assigned = creases.map((c) => {
      const next = overlay.get(c.id);
      return next ? { ...c, assignment: next satisfies CreaseAssignment } : c;
    });

    const maekawa = analyzeMaekawa(assigned, isInterior);
    if (maekawa.status !== "valid") continue;

    const blb = analyzeBigLittleBig(
      assigned,
      kawasaki.sectorAngles,
      kawasaki.sortedCreaseIds,
      isInterior,
    );
    if (blb.status === "invalid") continue;

    const layer = analyzeLayerOrder(
      assigned,
      kawasaki.sectorAngles,
      kawasaki.sortedCreaseIds,
      isInterior,
    );
    if (layer.status === "invalid") continue;

    const mountains = assigned.filter((c) => c.assignment === "mountain").length;
    const valleys = assigned.filter((c) => c.assignment === "valley").length;
    const assignments = free.map((c) => ({
      creaseId: c.id,
      assignment: overlay.get(c.id)!,
    }));
    results.push({
      assignments,
      mountains,
      valleys,
      maekawaDifference: maekawa.difference,
      explanation: `${mountains} mountain · ${valleys} valley satisfies Maekawa (${maekawa.difference > 0 ? "+2" : "−2"})${blb.status === "valid" ? " and big-little-big" : ""}.`,
    });
  }

  results.sort((a, b) => {
    // Prefer the conventional 3M/1V (+2) over 3V/1M, then fewer mountains.
    if (a.maekawaDifference !== b.maekawaDifference) {
      return b.maekawaDifference - a.maekawaDifference;
    }
    return a.mountains - b.mountains;
  });

  return results;
};
