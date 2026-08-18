/**
 * Derived mathematical analysis of the current document.
 *
 * Cached in a WeakMap keyed by document snapshot, so any number of
 * components can call this hook and the analysis runs at most once per
 * document change — including per-frame changes during a drag.
 */

import { useDocumentStore } from "./documentStore";
import { analyzeDocument, type DocumentAnalysis } from "@/origami/analysis";
import type { OrigamiDocument } from "@/origami/model";

const cache = new WeakMap<OrigamiDocument, DocumentAnalysis>();

export const getAnalysis = (doc: OrigamiDocument): DocumentAnalysis => {
  const hit = cache.get(doc);
  if (hit) return hit;
  const analysis = analyzeDocument(doc);
  cache.set(doc, analysis);
  return analysis;
};

export const useAnalysis = (): DocumentAnalysis => {
  const doc = useDocumentStore((s) => s.doc);
  return getAnalysis(doc);
};
