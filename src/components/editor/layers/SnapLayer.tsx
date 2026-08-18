"use client";

import { paperToScreen } from "@/editor/viewport";
import { useEditorStore } from "@/state/editorStore";
import { cyan, green, yellow } from "@/design-system/tokens";

/** Snap guides (alignment lines, angle rays) and the snap indicator. */
export function SnapLayer() {
  const snap = useEditorStore((s) => s.activeSnap);
  const viewport = useEditorStore((s) => s.viewport);

  if (!snap) return null;
  const p = paperToScreen(viewport, snap.position);
  const isKawasaki = snap.kind === "kawasaki";
  const accent = isKawasaki ? green : cyan;

  return (
    <g data-testid="snap-layer" pointerEvents="none">
      {snap.guides.map((guide, i) => {
        const a = paperToScreen(viewport, guide.from);
        const b = paperToScreen(viewport, guide.to);
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={guide.kind === "align" ? cyan : yellow}
            strokeWidth={1}
            strokeDasharray="4 4"
            opacity={0.85}
          />
        );
      })}
      {snap.kind !== "grid" && (
        <circle
          cx={p.x}
          cy={p.y}
          r={isKawasaki ? 10 : 8}
          fill="none"
          stroke={accent}
          strokeWidth={isKawasaki ? 2.5 : 1.5}
          opacity={0.95}
        />
      )}
      {snap.label && (
        <g transform={`translate(${p.x + 14}, ${p.y - 14})`}>
          <rect
            x={-4}
            y={-13}
            width={snap.label.length * 7.5 + 10}
            height={19}
            rx={5}
            fill={isKawasaki ? green : "#2b2a28"}
            opacity={0.92}
          />
          <text
            x={1}
            y={1}
            fontSize={11.5}
            fontWeight={700}
            fill="#fff"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {snap.label}
          </text>
        </g>
      )}
    </g>
  );
}
