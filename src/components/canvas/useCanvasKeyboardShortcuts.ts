import { useEffect } from "react";
import type { Canvas } from "../../types";
import type { CanvasTool } from "./canvasTypes";

/**
 * Wires the board-level keyboard shortcuts (undo, escape, duplicate, zoom, fit, and deletion)
 * onto the window. Keeping this isolated lets the board component stay focused on rendering while
 * the shortcut behavior remains easy to reason about and test on its own.
 *
 * Shortcuts are ignored while the user types in an input, textarea, or select element.
 */
export function useCanvasKeyboardShortcuts({
  activeCanvas,
  activeStrokeCount,
  editingEdgeId,
  selectedEdgeId,
  selectedObjectCount,
  setActiveTool,
  clearSelectedObjects,
  setSelectedEdgeId,
  undoLastStroke,
  duplicateSelectedObjects,
  deleteSelectedObjects,
  deleteEdge,
  resetZoom,
  fitCanvasContent,
  zoomToSelection,
}: {
  activeCanvas: Canvas | null;
  activeStrokeCount: number;
  editingEdgeId: string | null;
  selectedEdgeId: string | null;
  selectedObjectCount: number;
  setActiveTool: (tool: CanvasTool) => void;
  clearSelectedObjects: () => void;
  setSelectedEdgeId: (edgeId: string | null) => void;
  undoLastStroke: () => void;
  duplicateSelectedObjects: () => void;
  deleteSelectedObjects: () => void;
  deleteEdge: (edgeId: string) => void;
  resetZoom: () => void;
  fitCanvasContent: () => void;
  zoomToSelection: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const editingText =
        target instanceof Element &&
        Boolean(target.closest("input, textarea, select"));
      if (editingText) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
        if (activeStrokeCount) {
          event.preventDefault();
          undoLastStroke();
        }
        return;
      }

      if (event.key === "Escape") {
        setActiveTool("select");
        clearSelectedObjects();
        setSelectedEdgeId(null);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "d") {
        if (selectedObjectCount) {
          event.preventDefault();
          duplicateSelectedObjects();
        }
        return;
      }

      if (event.key === "0") {
        event.preventDefault();
        resetZoom();
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        fitCanvasContent();
        return;
      }

      if (event.key.toLowerCase() === "s" && selectedObjectCount) {
        event.preventDefault();
        zoomToSelection();
        return;
      }

      if (
        selectedObjectCount &&
        !editingEdgeId &&
        activeCanvas &&
        (event.key === "Delete" || event.key === "Backspace")
      ) {
        event.preventDefault();
        deleteSelectedObjects();
        return;
      }

      if (
        !selectedEdgeId ||
        editingEdgeId ||
        (event.key !== "Delete" && event.key !== "Backspace") ||
        !activeCanvas
      ) {
        return;
      }

      event.preventDefault();
      deleteEdge(selectedEdgeId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activeCanvas,
    activeStrokeCount,
    deleteEdge,
    deleteSelectedObjects,
    duplicateSelectedObjects,
    editingEdgeId,
    fitCanvasContent,
    resetZoom,
    selectedEdgeId,
    selectedObjectCount,
    setActiveTool,
    setSelectedEdgeId,
    clearSelectedObjects,
    undoLastStroke,
    zoomToSelection,
  ]);
}
