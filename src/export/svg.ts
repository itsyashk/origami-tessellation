/**
 * Export a crease pattern as a standalone SVG string.
 *
 * Follows origami-diagram conventions so exports are legible on paper:
 * mountains are dash-dot strokes, valleys are dashed, boundary/paper edge is
 * solid — assignment is never encoded by color alone.
 */

import { vertexMap, type CreaseAssignment, type OrigamiDocument } from "@/origami/model";

export interface SvgExportOptions {
  /** Pixels per paper unit in the exported file. */
  scale?: number;
  margin?: number;
  showVertices?: boolean;
  showLegend?: boolean;
}

interface StrokeStyle {
  color: string;
  dashArray: string | null;
  width: number;
}

const STROKES: Record<CreaseAssignment, StrokeStyle> = {
  mountain: { color: "#d6453d", dashArray: "8 3 1.5 3", width: 1.4 },
  valley: { color: "#1d7fd6", dashArray: "6 4", width: 1.4 },
  unassigned: { color: "#8a857c", dashArray: null, width: 1.1 },
  boundary: { color: "#2b2a28", dashArray: null, width: 2 },
};

const esc = (s: string): string =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const fmt = (n: number): string =>
  Number.isInteger(n) ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");

export const documentToSvg = (
  doc: OrigamiDocument,
  options: SvgExportOptions = {},
): string => {
  const { scale = 4, margin = 20, showVertices = true, showLegend = true } = options;
  const legendH = showLegend ? 22 : 0;
  const paperW = doc.paper.width * scale;
  const paperH = doc.paper.height * scale;
  const w = paperW + margin * 2;
  const h = paperH + margin * 2 + legendH;
  // Paper space is y-up; SVG is y-down. Legend sits in the extra bottom band.
  const px = (x: number) => margin + x * scale;
  const py = (y: number) => margin + paperH - y * scale;

  const vmap = vertexMap(doc);
  const lines: string[] = [];

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `  <title>${esc(doc.name)}</title>`,
    `  <desc>Origami crease pattern. Mountain folds: dash-dot. Valley folds: dashed.</desc>`,
    `  <rect x="0" y="0" width="${w}" height="${h}" fill="#faf6ef"/>`,
    `  <rect x="${margin}" y="${margin}" width="${paperW}" height="${paperH}" fill="#ffffff" stroke="#2b2a28" stroke-width="2"/>`,
  );

  for (const crease of doc.creases) {
    const a = vmap.get(crease.startVertexId);
    const b = vmap.get(crease.endVertexId);
    if (!a || !b) continue;
    const style = STROKES[crease.assignment];
    const dash = style.dashArray ? ` stroke-dasharray="${style.dashArray}"` : "";
    lines.push(
      `  <line x1="${fmt(px(a.x))}" y1="${fmt(py(a.y))}" x2="${fmt(px(b.x))}" y2="${fmt(py(b.y))}" stroke="${style.color}" stroke-width="${style.width}"${dash} stroke-linecap="round"/>`,
    );
  }

  if (showVertices) {
    for (const v of doc.vertices) {
      lines.push(
        `  <circle cx="${fmt(px(v.x))}" cy="${fmt(py(v.y))}" r="2.5" fill="#2b2a28"/>`,
      );
    }
  }

  if (showLegend) {
    const ly = h - 8;
    const swatch = (
      x: number,
      label: string,
      color: string,
      dash: string | null,
    ) => {
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : "";
      lines.push(
        `  <line x1="${x}" y1="${ly}" x2="${x + 18}" y2="${ly}" stroke="${color}" stroke-width="1.6"${dashAttr} stroke-linecap="round"/>`,
        `  <text x="${x + 22}" y="${ly + 3.5}" font-size="10" font-family="sans-serif" fill="#5f5b54">${label}</text>`,
      );
    };
    swatch(margin, "Mountain", "#d6453d", "8 3 1.5 3");
    swatch(margin + 90, "Valley", "#1d7fd6", "6 4");
    swatch(margin + 165, "Unassigned", "#8a857c", null);
  }

  lines.push("</svg>");
  return lines.join("\n");
};
