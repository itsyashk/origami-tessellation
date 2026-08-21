"use client";

import { useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  Undo2,
  Redo2,
  Download,
  Grid3x3,
  BookOpen,
  FilePlus2,
  FolderOpen,
  Keyboard,
  ChevronDown,
  Layers,
  FlipHorizontal,
} from "lucide-react";
import { ingestImportedDocument } from "@/origami/serialization";
import { tileMotif } from "@/origami/tiling";
import { renameDocument } from "@/origami/model";
import { SYMMETRY_LABELS } from "@/origami/symmetry";
import { downloadJson, downloadSvg, downloadFold } from "@/export/download";
import { applySymmetryMode } from "@/editor/controller";
import { useDocumentStore } from "@/state/documentStore";
import { useEditorStore } from "@/state/editorStore";

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-1 text-xs font-semibold text-(--ink-soft)">
      <span>{label}</span>
      <span className="flex gap-1">
        {keys.map((k) => (
          <kbd key={k} className="kbd">
            {k}
          </kbd>
        ))}
      </span>
    </div>
  );
}

export function TopBar() {
  const doc = useDocumentStore((s) => s.doc);
  const undo = useDocumentStore((s) => s.undo);
  const redo = useDocumentStore((s) => s.redo);
  const canUndo = useDocumentStore((s) => s.past.length > 0);
  const canRedo = useDocumentStore((s) => s.future.length > 0);
  const commit = useDocumentStore((s) => s.commit);
  const loadDocument = useDocumentStore((s) => s.loadDocument);
  const newDocument = useDocumentStore((s) => s.newDocument);
  const clearSelection = useEditorStore((s) => s.clearSelection);
  const resetGesture = useEditorStore((s) => s.resetGesture);
  const setFoldOpen = useEditorStore((s) => s.setFoldOpen);
  const setGalleryOpen = useEditorStore((s) => s.setGalleryOpen);
  const symmetry = useEditorStore((s) => s.symmetry);

  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [symmetryOpen, setSymmetryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      clearSelection();
      loadDocument(ingestImportedDocument(text));
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not open that file.",
      );
    }
  };

  const applyRepeat = () => {
    const selection = useEditorStore.getState().selection;
    commit(
      tileMotif(doc, {
        rows,
        columns: cols,
        motifVertexIds: [...selection.vertexIds],
      }),
    );
    setRepeatOpen(false);
  };

  return (
    <header className="flex h-13 items-center gap-2 border-b border-(--ink)/10 bg-(--card) px-3">
      {/* Brand + document name */}
      <div className="flex min-w-0 items-center gap-2.5">
        <div
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-(--yellow) shadow-[0_2px_0_rgba(43,42,40,0.25)]"
        >
          {/* tiny crease-pattern mark */}
          <svg width="18" height="18" viewBox="0 0 18 18">
            <rect x="3" y="3" width="12" height="12" fill="#fff" stroke="#2b2a28" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M3 15 L15 3" stroke="#d6453d" strokeWidth="1.2" strokeDasharray="2.6 1.6" />
            <path d="M3 3 L15 15" stroke="#1d7fd6" strokeWidth="1.2" strokeDasharray="1.8 1.6" />
          </svg>
        </div>
        <div className="hidden min-w-0 flex-col leading-tight sm:flex">
          <span className="text-[13px] font-extrabold tracking-tight">Origami</span>
          <input
            key={doc.name}
            className="-mx-1 w-40 truncate rounded px-1 text-[11.5px] font-semibold text-(--ink-soft) outline-none hover:bg-(--paper-shade) focus:bg-(--paper-bright) focus:outline-2 focus:outline-(--cyan)"
            defaultValue={doc.name}
            aria-label="Pattern name"
            data-testid="doc-name"
            // Renaming is one undo step, committed when editing finishes.
            onBlur={(ev) => {
              const name = ev.target.value.trim();
              if (name && name !== doc.name) commit(renameDocument(doc, name));
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
            }}
          />
        </div>
      </div>

      <div className="mx-1 h-6 w-px bg-(--ink)/10" aria-hidden />

      {/* File menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="btn btn-ghost" data-testid="menu-file">
            File <ChevronDown size={13} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="popover-surface min-w-52" sideOffset={6} align="start">
            <DropdownMenu.Item
              className="menu-item"
              data-testid="menu-new"
              onSelect={() => {
                clearSelection();
                newDocument();
              }}
            >
              <FilePlus2 size={15} /> New pattern
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="menu-item"
              onSelect={() => fileInputRef.current?.click()}
            >
              <FolderOpen size={15} /> Open JSON or FOLD…
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-(--ink)/10" />
            <DropdownMenu.Item
              className="menu-item"
              data-testid="export-svg"
              onSelect={() => downloadSvg(doc)}
            >
              <Download size={15} /> Export SVG
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="menu-item"
              data-testid="export-json"
              onSelect={() => downloadJson(doc)}
            >
              <Download size={15} /> Export JSON
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="menu-item"
              data-testid="export-fold"
              onSelect={() => downloadFold(doc)}
            >
              <Download size={15} /> Export FOLD
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Pattern library */}
      <button
        type="button"
        className="btn btn-ghost"
        data-testid="menu-patterns"
        onClick={() => setGalleryOpen(true)}
        title="Pattern library (G)"
      >
        <BookOpen size={15} />
        <span className="hidden md:inline">Patterns</span>
      </button>

      {/* Repeat */}
      <Popover.Root open={repeatOpen} onOpenChange={setRepeatOpen}>
        <Popover.Trigger asChild>
          <button type="button" className="btn btn-ghost" data-testid="menu-repeat">
            <Grid3x3 size={15} />
            <span className="hidden md:inline">Repeat</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="popover-surface w-60 p-3" sideOffset={6}>
            <p className="mb-2 text-xs font-bold text-(--ink)">
              Repeat motif in a grid
            </p>
            <p className="mb-3 text-[11px] font-medium leading-snug text-(--ink-faint)">
              Tiles the selected vertices — or the whole pattern — edge to
              edge. Coincident vertices merge.
            </p>
            <div className="mb-3 flex items-center gap-2">
              <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-(--ink-faint)">
                Rows
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={rows}
                  data-testid="repeat-rows"
                  className="field tnum"
                  onChange={(ev) =>
                    setRows(Math.max(1, Math.min(8, Number(ev.target.value) || 1)))
                  }
                />
              </label>
              <span className="mt-4 text-(--ink-faint)">×</span>
              <label className="flex flex-1 flex-col gap-1 text-[11px] font-bold text-(--ink-faint)">
                Columns
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={cols}
                  data-testid="repeat-cols"
                  className="field tnum"
                  onChange={(ev) =>
                    setCols(Math.max(1, Math.min(8, Number(ev.target.value) || 1)))
                  }
                />
              </label>
            </div>
            <button
              type="button"
              className="btn btn-primary w-full"
              data-testid="repeat-apply"
              onClick={applyRepeat}
            >
              Repeat {rows} × {cols}
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Construction symmetry */}
      <Popover.Root open={symmetryOpen} onOpenChange={setSymmetryOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="menu-symmetry"
            data-active={symmetry !== "off"}
            title="Construction symmetry (Shift+2 / Shift+4)"
          >
            <FlipHorizontal size={15} />
            <span className="hidden md:inline">
              {symmetry === "off" ? "Symmetry" : SYMMETRY_LABELS[symmetry]}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="popover-surface w-64 p-3" sideOffset={6}>
            <p className="mb-2 text-xs font-bold text-(--ink)">
              Construction symmetry
            </p>
            <p className="mb-3 text-[11px] font-medium leading-snug text-(--ink-faint)">
              Copies bake into the pattern around the paper centre. 4-fold
              assumes square paper; copies off the sheet are clamped.
            </p>
            <div className="flex flex-col gap-1">
              {(
                [
                  ["off", "Off"],
                  ["c2", SYMMETRY_LABELS.c2],
                  ["c4", SYMMETRY_LABELS.c4],
                  ["mx", SYMMETRY_LABELS.mx],
                  ["my", SYMMETRY_LABELS.my],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="menu-item"
                  data-active={symmetry === kind}
                  data-testid={`symmetry-${kind}`}
                  onClick={() => {
                    applySymmetryMode(kind);
                    setSymmetryOpen(false);
                  }}
                >
                  {label}
                  {kind === "c2" ? (
                    <span className="ml-auto text-[10px] font-bold text-(--ink-faint)">
                      ⇧2
                    </span>
                  ) : kind === "c4" ? (
                    <span className="ml-auto text-[10px] font-bold text-(--ink-faint)">
                      ⇧4
                    </span>
                  ) : kind === "off" ? (
                    <span className="ml-auto text-[10px] font-bold text-(--ink-faint)">
                      ⇧0
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Fold preview */}
      <button
        type="button"
        className="btn btn-ghost"
        data-testid="menu-fold"
        onClick={() => setFoldOpen(true)}
        title="Fold preview (F)"
      >
        <Layers size={15} />
        <span className="hidden md:inline">Fold</span>
      </button>

      <div className="flex-1" />

      {/* Undo / redo */}
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 px-0"
        onClick={() => {
          resetGesture();
          undo();
        }}
        disabled={!canUndo}
        aria-label="Undo"
        data-testid="undo-button"
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        type="button"
        className="btn btn-ghost h-9 w-9 px-0"
        onClick={() => {
          resetGesture();
          redo();
        }}
        disabled={!canRedo}
        aria-label="Redo"
        data-testid="redo-button"
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>

      {/* Shortcuts help */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="btn btn-ghost hidden h-9 w-9 px-0 sm:inline-flex"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts"
          >
            <Keyboard size={16} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="popover-surface w-72 p-3" sideOffset={6} align="end">
            <p className="mb-1.5 text-xs font-extrabold">Shortcuts</p>
            <ShortcutRow keys={["V"]} label="Select" />
            <ShortcutRow keys={["P"]} label="Place vertices" />
            <ShortcutRow keys={["C"]} label="Draw creases" />
            <ShortcutRow keys={["H"]} label="Pan" />
            <ShortcutRow keys={["G"]} label="Pattern library" />
            <ShortcutRow keys={["F"]} label="Fold preview" />
            <ShortcutRow keys={["1", "2", "3"]} label="Mountain / valley / clear" />
            <ShortcutRow keys={["⇧", "2"]} label="2-fold symmetry" />
            <ShortcutRow keys={["⇧", "4"]} label="4-fold symmetry" />
            <ShortcutRow keys={["⇧", "0"]} label="Symmetry off" />
            <ShortcutRow keys={["Enter"]} label="Place vertex / complete crease" />
            <ShortcutRow keys={["↑", "↓", "←", "→"]} label="Nudge selection" />
            <ShortcutRow keys={["Ctrl", "A"]} label="Select all" />
            <ShortcutRow keys={["Ctrl", "Z"]} label="Undo" />
            <ShortcutRow keys={["Ctrl", "⇧", "Z"]} label="Redo" />
            <ShortcutRow keys={["Del"]} label="Delete selection" />
            <ShortcutRow keys={["Esc"]} label="Cancel / deselect" />
            <ShortcutRow keys={["Space"]} label="Hold to pan" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Primary export action */}
      <button
        type="button"
        className="btn btn-primary ml-1"
        data-testid="export-primary"
        onClick={() => downloadSvg(doc)}
      >
        <Download size={14} />
        <span className="hidden sm:inline">Export</span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.fold,application/json"
        className="hidden"
        data-testid="import-file"
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          if (file) void importJson(file);
          ev.target.value = "";
        }}
      />
    </header>
  );
}
