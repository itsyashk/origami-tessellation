import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnalysisPanel } from "./AnalysisPanel";
import { useDocumentStore } from "@/state/documentStore";
import { squareTwist, singleVertexPlayground } from "@/origami/examples";
import { emptyDocument, moveVertex } from "@/origami/model";

describe("AnalysisPanel", () => {
  beforeEach(() => {
    useDocumentStore.setState({
      doc: emptyDocument(),
      past: [],
      future: [],
      transactionBase: null,
    });
  });

  it("explains itself on an empty document", () => {
    render(<AnalysisPanel />);
    expect(screen.getByText(/Kawasaki, Maekawa, and/)).toBeInTheDocument();
  });

  it("summarizes a fully valid pattern", () => {
    useDocumentStore.setState({ doc: squareTwist() });
    render(<AnalysisPanel />);
    expect(screen.getByTestId("analysis-flat-foldable")).toHaveTextContent(
      "4/4 flat-foldable",
    );
  });

  it("counts broken vertices after an invalid move", () => {
    // Slide the east endpoint along the paper edge (it stays a boundary
    // vertex) so only the center vertex is interior — and now invalid.
    const doc = moveVertex(singleVertexPlayground(), "east", { x: 200, y: 160 });
    useDocumentStore.setState({ doc });
    render(<AnalysisPanel />);
    expect(screen.getByTestId("analysis-flat-foldable")).toHaveTextContent(
      "0/1 flat-foldable",
    );
    expect(screen.getByTestId("analysis-invalid")).toHaveTextContent("1 to fix");
  });
});
