"use client";

/**
 * The pattern library gallery — the front door of the tutorial experience.
 * Browse by category, open a pattern in the editor, or jump straight to
 * watching it fold.
 */

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Play, PencilRuler, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  PATTERNS,
  type PatternCategory,
  type PatternDifficulty,
  type PatternEntry,
} from "@/origami/patterns/library";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";
import { PatternThumbnail } from "./PatternThumbnail";

const DIFFICULTY_CHIP: Record<PatternDifficulty, string> = {
  beginner: "chip chip-valid",
  intermediate: "chip chip-near",
  advanced: "chip chip-invalid",
};

const FILTERS: (PatternCategory | "all")[] = [
  "all",
  "bases",
  "pleats",
  "vertices",
  "twists",
  "tessellations",
];

function PatternCard({
  pattern,
  onOpen,
  onFold,
}: {
  pattern: PatternEntry;
  onOpen: () => void;
  onFold: () => void;
}) {
  const doc = useMemo(() => pattern.build(), [pattern]);
  return (
    <div
      className="craft-card flex flex-col gap-2 p-3 transition-shadow hover:shadow-(--shadow-lifted)"
      data-testid={`pattern-${pattern.slug}`}
    >
      <div className="flex items-start gap-3">
        <PatternThumbnail doc={doc} size={92} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[13px] font-extrabold leading-tight">
            {pattern.title}
          </h3>
          <span className={`${DIFFICULTY_CHIP[pattern.difficulty]} self-start`}>
            {pattern.difficulty}
          </span>
        </div>
      </div>
      <p className="min-h-9 text-[11.5px] font-medium leading-snug text-(--ink-soft)">
        {pattern.description}
      </p>
      <div className="mt-auto flex gap-2">
        <button
          type="button"
          className="btn btn-primary flex-1"
          data-testid={`fold-pattern-${pattern.slug}`}
          onClick={onFold}
        >
          <Play size={13} /> Watch it fold
        </button>
        <button
          type="button"
          className="btn btn-outline"
          data-testid={`open-pattern-${pattern.slug}`}
          onClick={onOpen}
          title="Open in the editor"
        >
          <PencilRuler size={13} /> Edit
        </button>
      </div>
    </div>
  );
}

export function PatternBrowser() {
  const open = useEditorStore((s) => s.galleryOpen);
  const setGalleryOpen = useEditorStore((s) => s.setGalleryOpen);
  const setFoldOpen = useEditorStore((s) => s.setFoldOpen);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const loadDocument = useDocumentStore((s) => s.loadDocument);
  const [filter, setFilter] = useState<PatternCategory | "all">("all");

  const visible =
    filter === "all" ? PATTERNS : PATTERNS.filter((p) => p.category === filter);

  const load = (pattern: PatternEntry, thenFold: boolean) => {
    clearSelection();
    loadDocument(pattern.build());
    setGalleryOpen(false);
    if (thenFold) setFoldOpen(true);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setGalleryOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-(--ink)/30 backdrop-blur-[2px]" />
        <Dialog.Content
          className="craft-card fixed left-1/2 top-1/2 z-50 flex h-[min(90dvh,760px)] w-[min(96vw,1040px)] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 p-4 focus:outline-none"
          aria-describedby={undefined}
          data-testid="pattern-browser"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Dialog.Title className="text-sm font-extrabold">
              Pattern library
            </Dialog.Title>
            <span className="font-hand hidden text-[16px] text-(--ink-faint) sm:inline">
              pick one → watch it fold → then pull it apart in the editor
            </span>
            <div className="flex-1" />
            <Dialog.Close asChild>
              <button
                type="button"
                className="btn btn-ghost h-8 w-8 px-0"
                aria-label="Close pattern library"
                data-testid="gallery-close"
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="segment self-start" role="group" aria-label="Filter by category">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                data-active={filter === f}
                data-testid={`filter-${f}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : CATEGORY_LABELS[f]}
              </button>
            ))}
          </div>

          <div
            className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3"
            data-testid="pattern-grid"
          >
            {visible.map((pattern) => (
              <PatternCard
                key={pattern.slug}
                pattern={pattern}
                onOpen={() => load(pattern, false)}
                onFold={() => load(pattern, true)}
              />
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
