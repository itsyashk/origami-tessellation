"use client";

/**
 * Inline math feedback that lives next to the geometry: small badges beside
 * interior vertices that are near-valid or invalid ("Kawasaki · 2.1° off"),
 * and a green check beside the dragged vertex when it is exactly valid.
 * Valid, untouched vertices stay quiet — the paper is the focus.
 */

import { paperToScreen } from "@/editor/viewport";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { useAnalysis } from "@/state/useAnalysis";
import { green, statusColors } from "@/design-system/tokens";

interface Badge {
  vertexId: string;
  x: number;
  y: number;
  text: string;
  tone: "near" | "invalid" | "valid";
}

const TONE_FILL: Record<Badge["tone"], string> = {
  near: statusColors.near,
  invalid: statusColors.invalid,
  valid: green,
};

export function AnalysisBadgeLayer() {
  const doc = useDocumentStore((s) => s.doc);
  const viewport = useEditorStore((s) => s.viewport);
  const draggingId = useEditorStore((s) => s.draggingVertexId);
  const analysis = useAnalysis();

  const badges: Badge[] = [];
  for (const v of doc.vertices) {
    const va = analysis.byVertex.get(v.id);
    if (!va || !va.isInterior || va.degree === 0) continue;
    const k = va.kawasaki;
    const m = va.maekawa;
    const p = paperToScreen(viewport, v);

    if (k.status === "near" || k.status === "invalid") {
      const off = Math.abs(k.errorDegrees);
      badges.push({
        vertexId: v.id,
        x: p.x,
        y: p.y,
        text:
          k.status === "invalid" && k.sectorAngles.length === 0
            ? "Kawasaki · odd degree"
            : `Kawasaki · ${off.toFixed(1)}° off`,
        tone: k.status === "invalid" ? "invalid" : "near",
      });
    } else if (m.status === "invalid") {
      badges.push({
        vertexId: v.id,
        x: p.x,
        y: p.y,
        text: `Maekawa · M−V = ${m.difference}`,
        tone: "invalid",
      });
    } else if (v.id === draggingId && k.status === "valid") {
      badges.push({
        vertexId: v.id,
        x: p.x,
        y: p.y,
        text: "Kawasaki ✓",
        tone: "valid",
      });
    }
  }

  return (
    <g data-testid="analysis-badges" pointerEvents="none">
      {badges.map((badge) => (
        <g
          key={badge.vertexId}
          transform={`translate(${badge.x + 12}, ${badge.y + 20})`}
          data-badge-tone={badge.tone}
        >
          <rect
            x={0}
            y={-13}
            width={badge.text.length * 6.6 + 14}
            height={20}
            rx={6}
            fill={TONE_FILL[badge.tone]}
            opacity={0.94}
          />
          <text
            x={7}
            y={1.5}
            fontSize={11.5}
            fontWeight={700}
            fill="#fff"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {badge.text}
          </text>
        </g>
      ))}
    </g>
  );
}
