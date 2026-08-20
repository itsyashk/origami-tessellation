"use client";

/**
 * Rubber-band rectangle for marquee selection. Screen-space (not paper),
 * so the box stays axis-aligned on the display while paper y is up.
 */

import { useEditorStore } from "@/state/editorStore";
import { cyan } from "@/design-system/tokens";

export function MarqueeLayer() {
  const marquee = useEditorStore((s) => s.marquee);
  if (!marquee) return null;
  const x = Math.min(marquee.start.x, marquee.end.x);
  const y = Math.min(marquee.start.y, marquee.end.y);
  const w = Math.abs(marquee.end.x - marquee.start.x);
  const h = Math.abs(marquee.end.y - marquee.start.y);
  if (w < 1 && h < 1) return null;
  return (
    <rect
      data-testid="marquee-rect"
      x={x}
      y={y}
      width={w}
      height={h}
      fill={cyan}
      fillOpacity={0.12}
      stroke={cyan}
      strokeWidth={1.25}
      strokeDasharray="4 3"
      pointerEvents="none"
    />
  );
}
