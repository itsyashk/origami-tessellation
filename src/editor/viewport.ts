/**
 * Viewport transform between paper coordinates and screen (SVG pixel)
 * coordinates.
 *
 * Paper space is y-up (mathematical convention, matches FOLD and future
 * solver code); screen space is y-down. The transform therefore flips y:
 *
 *   screen.x = (paper.x − pan.x) · zoom
 *   screen.y = viewportHeight − (paper.y − pan.y) · zoom
 */

import type { Vec2 } from "@/geometry/vec2";

export interface Viewport {
  /** Paper-space coordinate that maps to the bottom-left of the screen. */
  pan: Vec2;
  /** Screen pixels per paper unit. */
  zoom: number;
  /** Screen size in CSS pixels. */
  width: number;
  height: number;
}

export const paperToScreen = (vp: Viewport, p: Vec2): Vec2 => ({
  x: (p.x - vp.pan.x) * vp.zoom,
  y: vp.height - (p.y - vp.pan.y) * vp.zoom,
});

export const screenToPaper = (vp: Viewport, s: Vec2): Vec2 => ({
  x: s.x / vp.zoom + vp.pan.x,
  y: (vp.height - s.y) / vp.zoom + vp.pan.y,
});

/** Convert a screen-space length (px) to paper units. */
export const screenLengthToPaper = (vp: Viewport, px: number): number =>
  px / vp.zoom;

/** Zoom about a fixed screen point (keeps that point stationary). */
export const zoomAt = (
  vp: Viewport,
  screenPoint: Vec2,
  nextZoom: number,
): Viewport => {
  const clamped = Math.min(40, Math.max(0.1, nextZoom));
  const anchor = screenToPaper(vp, screenPoint);
  // Solve pan so that anchor maps back to screenPoint at the new zoom.
  const pan = {
    x: anchor.x - screenPoint.x / clamped,
    y: anchor.y - (vp.height - screenPoint.y) / clamped,
  };
  return { ...vp, zoom: clamped, pan };
};

export const panBy = (vp: Viewport, screenDelta: Vec2): Viewport => ({
  ...vp,
  pan: {
    x: vp.pan.x - screenDelta.x / vp.zoom,
    y: vp.pan.y + screenDelta.y / vp.zoom,
  },
});

/** Fit a paper rect (with margin in px) centered in the viewport. */
export const fitToPaper = (
  width: number,
  height: number,
  paperWidth: number,
  paperHeight: number,
  marginPx = 64,
): Viewport => {
  const usableW = Math.max(50, width - marginPx * 2);
  const usableH = Math.max(50, height - marginPx * 2);
  const zoom = Math.min(usableW / paperWidth, usableH / paperHeight);
  const pan = {
    x: -(width / zoom - paperWidth) / 2,
    y: -(height / zoom - paperHeight) / 2,
  };
  return { pan, zoom, width, height };
};
