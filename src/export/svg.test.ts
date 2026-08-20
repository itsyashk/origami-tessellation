import { describe, expect, it } from "vitest";
import { documentToSvg } from "./svg";
import { squareTwist } from "@/origami/examples";

describe("documentToSvg", () => {
  const svg = documentToSvg(squareTwist());

  it("produces a standalone SVG document", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain("</svg>");
    expect(svg).toContain("<title>Square Twist</title>");
  });

  it("renders every crease and vertex", () => {
    expect(svg.match(/<line /g)).toHaveLength(15); // 12 creases + 3 legend swatches
    // 12 pattern vertices as circles.
    expect(svg.match(/<circle /g)).toHaveLength(12);
    expect(svg).toContain(">Mountain</text>");
    expect(svg).toContain(">Valley</text>");
  });

  it("distinguishes mountain and valley by dash pattern, not just color", () => {
    expect(svg).toContain('stroke-dasharray="8 3 1.5 3"'); // mountain dash-dot
    expect(svg).toContain('stroke-dasharray="6 4"'); //       valley dashed
  });

  it("escapes the document name", () => {
    const doc = { ...squareTwist(), name: "<b>&evil</b>" };
    const out = documentToSvg(doc);
    expect(out).not.toContain("<b>");
    expect(out).toContain("&lt;b&gt;");
  });
});
