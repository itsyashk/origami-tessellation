"use client";

/**
 * Live document-level math summary. Per-vertex detail lives in the
 * inspector; badges on the canvas carry the point-of-work feedback.
 */

import { Check, TriangleAlert, CircleAlert } from "lucide-react";
import { useAnalysis } from "@/state/useAnalysis";

export function AnalysisPanel() {
  const analysis = useAnalysis();
  const { interiorVertexCount, validVertexCount, invalidVertexCount, nearVertexCount } =
    analysis;

  const allValid =
    interiorVertexCount > 0 && validVertexCount === interiorVertexCount;

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="analysis-panel"
      aria-live="polite"
      aria-atomic="true"
    >
      <h2 className="px-1 text-[11px] font-extrabold uppercase tracking-wider text-(--ink-faint)">
        Analysis
      </h2>
      {interiorVertexCount === 0 ? (
        <p className="px-1 text-xs font-semibold leading-relaxed text-(--ink-faint)">
          Interior vertices will be checked against Kawasaki, Maekawa, and
          big-little-big as you draw.
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 px-1">
          <span
            className={`chip ${allValid ? "chip-valid" : "chip-muted"}`}
            data-testid="analysis-flat-foldable"
          >
            {allValid ? <Check size={13} strokeWidth={3} /> : null}
            {validVertexCount}/{interiorVertexCount} flat-foldable
          </span>
          {nearVertexCount > 0 && (
            <span className="chip chip-near" data-testid="analysis-near">
              <TriangleAlert size={13} strokeWidth={2.5} />
              {nearVertexCount} almost valid
            </span>
          )}
          {invalidVertexCount > 0 && (
            <span className="chip chip-invalid" data-testid="analysis-invalid">
              <CircleAlert size={13} strokeWidth={2.5} />
              {invalidVertexCount} to fix
            </span>
          )}
        </div>
      )}
    </div>
  );
}
