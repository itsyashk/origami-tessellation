/**
 * Design tokens shared between CSS and SVG rendering.
 * Keep in sync with the CSS custom properties in `app/globals.css`.
 * Crease meaning is encoded by BOTH color and dash treatment (accessibility).
 */

export const ink = "#2b2a28";
export const inkSoft = "#5f5b54";
export const inkFaint = "#97917f";

export const cyan = "#1ba5c4";
export const yellow = "#ffc94d";
export const coral = "#e2574c";
export const green = "#3d9b6c";

export const creaseStyles = {
  mountain: { stroke: "#d6453d", dashArray: "7 3 1.5 3", width: 2 },
  valley: { stroke: "#1d7fd6", dashArray: "5 4", width: 2 },
  unassigned: { stroke: "#8a857c", dashArray: undefined, width: 1.5 },
  boundary: { stroke: ink, dashArray: undefined, width: 2.5 },
} as const;

export const statusColors = {
  valid: green,
  near: "#b98a00",
  invalid: coral,
  "not-applicable": inkFaint,
} as const;
