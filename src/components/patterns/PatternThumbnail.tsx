"use client";

/** Miniature crease-pattern rendering for gallery cards. */

import { useMemo } from "react";
import type { OrigamiDocument } from "@/origami/model";
import { vertexMap } from "@/origami/model";
import { creaseStyles } from "@/design-system/tokens";

export function PatternThumbnail({
  doc,
  size = 128,
}: {
  doc: OrigamiDocument;
  size?: number;
}) {
  const vmap = useMemo(() => vertexMap(doc), [doc]);
  const { width, height } = doc.paper;
  const pad = Math.max(width, height) * 0.06;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-pad} ${-pad} ${width + 2 * pad} ${height + 2 * pad}`}
      aria-hidden
      className="rounded-md"
    >
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="#ffffff"
        stroke="#2b2a28"
        strokeWidth={2.5}
      />
      {/* Paper space is y-up; flip for SVG. */}
      <g transform={`translate(0 ${height}) scale(1 -1)`}>
        {doc.creases.map((crease) => {
          const a = vmap.get(crease.startVertexId);
          const b = vmap.get(crease.endVertexId);
          if (!a || !b) return null;
          const style = creaseStyles[crease.assignment];
          return (
            <line
              key={crease.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={style.stroke}
              strokeWidth={2}
              strokeDasharray={style.dashArray ? "6 4" : undefined}
              strokeLinecap="round"
            />
          );
        })}
      </g>
    </svg>
  );
}
