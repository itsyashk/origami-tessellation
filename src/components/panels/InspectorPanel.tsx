"use client";

/**
 * Contextual inspector: appears when geometry is selected, next to the
 * canvas. Shows measurements and the crease assignment control; per-vertex
 * math is spelled out with expected vs actual values.
 */

import { Trash2 } from "lucide-react";
import { radToDeg } from "@/geometry/angles";
import {
  applyCreaseAssignments,
  deleteGeometry,
  moveVertex,
  setCreaseAssignment,
  vertexMap,
  type CreaseAssignment,
} from "@/origami/model";
import { planarizeDocument } from "@/origami/planarize";
import { suggestAssignments } from "@/origami/suggestAssignment";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore, emptySelection } from "@/state/editorStore";
import { useAnalysis } from "@/state/useAnalysis";

const ASSIGNMENT_OPTIONS: { value: CreaseAssignment; label: string; swatch: string }[] = [
  { value: "mountain", label: "Mountain", swatch: "#d6453d" },
  { value: "valley", label: "Valley", swatch: "#1d7fd6" },
  { value: "unassigned", label: "None", swatch: "#8a857c" },
];

const STATUS_CHIP: Record<string, string> = {
  valid: "chip chip-valid",
  near: "chip chip-near",
  invalid: "chip chip-invalid",
  "not-applicable": "chip chip-muted",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-bold text-(--ink-faint)">{label}</span>
      <span className="tnum font-bold text-(--ink)">{children}</span>
    </div>
  );
}

export function InspectorPanel() {
  const doc = useDocumentStore((s) => s.doc);
  const commit = useDocumentStore((s) => s.commit);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const analysis = useAnalysis();

  const vertexIds = [...selection.vertexIds];
  const creaseIds = [...selection.creaseIds];
  if (vertexIds.length === 0 && creaseIds.length === 0) return null;

  const vmap = vertexMap(doc);

  const deleteSelected = () => {
    commit(deleteGeometry(doc, vertexIds, creaseIds));
    setSelection(emptySelection);
  };

  const singleVertex = vertexIds.length === 1 ? vmap.get(vertexIds[0]) : undefined;
  const va = singleVertex ? analysis.byVertex.get(singleVertex.id) : undefined;

  const selectedCreases = creaseIds
    .map((id) => doc.creases.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  const singleCrease = selectedCreases.length === 1 ? selectedCreases[0] : undefined;
  const sharedAssignment = selectedCreases.every(
    (c) => c.assignment === selectedCreases[0]?.assignment,
  )
    ? selectedCreases[0]?.assignment
    : undefined;

  const creaseLength = (() => {
    if (!singleCrease) return null;
    const a = vmap.get(singleCrease.startVertexId);
    const b = vmap.get(singleCrease.endVertexId);
    if (!a || !b) return null;
    return Math.hypot(a.x - b.x, a.y - b.y);
  })();

  const suggestions = singleVertex ? suggestAssignments(doc, singleVertex.id) : [];
  const firstSuggestion = suggestions[0];

  return (
    <aside
      className="craft-card flex w-full flex-col gap-4 p-4 md:w-64"
      data-testid="inspector-panel"
      aria-label="Selection inspector"
    >
      {/* ------------------------------------------------ vertex section */}
      {singleVertex && va && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-(--ink-faint)">
            Vertex
          </h2>
          <div className="flex gap-2">
            {(["x", "y"] as const).map((axis) => {
              // One undo step per edit: uncontrolled while typing, committed
              // on blur/Enter. The key refreshes the field when the vertex
              // moves by other means (drag, nudge, undo).
              const current = Number(singleVertex[axis].toFixed(2));
              const commitValue = (raw: string) => {
                if (raw.trim() === "") return;
                const value = Number(raw);
                if (!Number.isFinite(value) || value === current) return;
                commit(
                  planarizeDocument(
                    moveVertex(doc, singleVertex.id, {
                      x: axis === "x" ? value : singleVertex.x,
                      y: axis === "y" ? value : singleVertex.y,
                    }),
                  ),
                );
              };
              return (
                <label
                  key={axis}
                  className="flex flex-1 items-center gap-1.5 text-xs font-bold text-(--ink-faint)"
                >
                  {axis.toUpperCase()}
                  <input
                    key={`${singleVertex.id}-${axis}-${current}`}
                    className="field tnum"
                    type="number"
                    step="1"
                    defaultValue={current}
                    data-testid={`vertex-${axis}-input`}
                    onBlur={(ev) => commitValue(ev.target.value)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
                    }}
                  />
                </label>
              );
            })}
          </div>
          <Row label="Degree">{va.degree}</Row>
          <Row label="Position">{va.isInterior ? "interior" : "boundary"}</Row>

          <div className="mt-1 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-(--ink-faint)">Kawasaki</span>
              <span className={STATUS_CHIP[va.kawasaki.status]} data-testid="kawasaki-chip">
                {va.kawasaki.status === "valid"
                  ? "✓ 180° · 180°"
                  : va.kawasaki.status === "not-applicable"
                    ? "n/a"
                    : `${Math.abs(va.kawasaki.errorDegrees).toFixed(1)}° off`}
              </span>
            </div>
            {va.kawasaki.sectorAngles.length > 0 && (
              <p className="tnum text-[11px] font-semibold leading-relaxed text-(--ink-soft)">
                Sectors:{" "}
                {va.kawasaki.sectorAngles
                  .map((s) => `${radToDeg(s).toFixed(1)}°`)
                  .join(" · ")}
              </p>
            )}
            <p className="text-[11px] font-semibold leading-relaxed text-(--ink-faint)">
              {va.kawasaki.explanation}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-(--ink-faint)">Maekawa</span>
              <span className={STATUS_CHIP[va.maekawa.status]} data-testid="maekawa-chip">
                {va.maekawa.status === "valid"
                  ? `✓ ${va.maekawa.difference > 0 ? "+2" : "−2"}`
                  : va.maekawa.status === "not-applicable"
                    ? "n/a"
                    : `M−V = ${va.maekawa.difference}`}
              </span>
            </div>
            <p className="tnum text-[11px] font-semibold text-(--ink-soft)">
              {va.maekawa.mountains} mountain · {va.maekawa.valleys} valley
              {va.maekawa.unassigned > 0 ? ` · ${va.maekawa.unassigned} free` : ""}
            </p>
            <p className="text-[11px] font-semibold leading-relaxed text-(--ink-faint)">
              {va.maekawa.explanation}
            </p>
          </div>

          {va.degree >= 4 && va.isInterior && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-(--ink-faint)">Big-little-big</span>
                <span className={STATUS_CHIP[va.bigLittleBig.status]} data-testid="blb-chip">
                  {va.bigLittleBig.status === "valid"
                    ? "✓ opposite"
                    : va.bigLittleBig.status === "not-applicable"
                      ? "n/a"
                      : "same fold"}
                </span>
              </div>
              <p className="text-[11px] font-semibold leading-relaxed text-(--ink-faint)">
                {va.bigLittleBig.explanation}
              </p>
            </div>
          )}

          {va.degree === 4 && va.isInterior && va.layerOrder.status !== "not-applicable" && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-(--ink-faint)">Layer order</span>
                <span className={STATUS_CHIP[va.layerOrder.status]} data-testid="layer-chip">
                  {va.layerOrder.status === "valid"
                    ? "✓ local"
                    : va.layerOrder.status === "invalid"
                      ? "collision"
                      : "n/a"}
                </span>
              </div>
              <p className="text-[11px] font-semibold leading-relaxed text-(--ink-faint)">
                {va.layerOrder.explanation}
              </p>
            </div>
          )}

          {firstSuggestion && (
            <button
              type="button"
              className="btn btn-outline mt-1 self-start"
              data-testid="apply-assignment-suggestion"
              onClick={() =>
                commit(applyCreaseAssignments(doc, firstSuggestion.assignments))
              }
            >
              Assign {firstSuggestion.mountains}M / {firstSuggestion.valleys}V
              {suggestions.length > 1 ? ` · ${suggestions.length} ways` : ""}
            </button>
          )}
        </section>
      )}

      {vertexIds.length > 1 && (
        <p className="text-xs font-bold text-(--ink-soft)">
          {vertexIds.length} vertices selected
        </p>
      )}

      {/* ------------------------------------------------ crease section */}
      {selectedCreases.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-(--ink-faint)">
            {selectedCreases.length === 1
              ? "Crease"
              : `${selectedCreases.length} creases`}
          </h2>
          <div
            className="segment"
            role="group"
            aria-label="Fold assignment"
            data-testid="assignment-picker"
          >
            {ASSIGNMENT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                data-active={sharedAssignment === option.value}
                data-testid={`assign-${option.value}`}
                onClick={() =>
                  commit(setCreaseAssignment(doc, creaseIds, option.value))
                }
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: option.swatch }}
                />
                {option.label}
              </button>
            ))}
          </div>
          {creaseLength !== null && (
            <Row label="Length">{creaseLength.toFixed(1)} units</Row>
          )}
        </section>
      )}

      <button
        type="button"
        className="btn btn-outline mt-1 self-start text-(--coral)"
        onClick={deleteSelected}
        data-testid="delete-selected"
      >
        <Trash2 size={14} /> Delete
      </button>
    </aside>
  );
}
