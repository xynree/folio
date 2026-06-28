import { useCallback } from "react";
import type {
  Canvas,
  CanvasLink,
  CanvasNote,
  CanvasSection,
  CanvasTextSize,
} from "../../types";
import { createId } from "../folio/model";
import {
  deleteCanvasLink,
  deleteCanvasNote,
  deleteCanvasSection,
  deleteCanvasTextElement,
  removeItemFromCanvas,
  removeNoteFromCanvas,
  updateCanvasLink,
  updateCanvasNoteSize,
  updateCanvasNoteText,
  updateCanvasSection,
  updateCanvasTextElementSize,
  updateCanvasTextElementText,
} from "./canvasModel";

/** Applies an updater to the canvas with the given id, optionally recording a status message. */
export type UpdateCanvasHandler = (
  canvasId: string,
  updater: (canvas: Canvas) => Canvas,
  message?: string,
) => void;

/**
 * Groups the small content mutation handlers for a board (notes, links, sections, text,
 * and item removal) into a single isolated unit. Each handler is a thin wrapper that targets
 * the active canvas, so the board component does not need to repeat the null check and id wiring.
 */
export function useCanvasObjectMutations({
  activeCanvas,
  updateCanvas,
}: {
  activeCanvas: Canvas | null;
  updateCanvas: UpdateCanvasHandler;
}) {
  const addNote = useCallback(() => {
    if (!activeCanvas) return;
    const createdAt = new Date().toISOString();
    const note: CanvasNote = {
      id: createId("note"),
      text: "",
      x: 140,
      y: 120,
      createdAt,
      updatedAt: createdAt,
    };
    updateCanvas(
      activeCanvas.id,
      (canvas) => ({ ...canvas, notes: [...canvas.notes, note] }),
      "Note added",
    );
  }, [activeCanvas, updateCanvas]);

  const removeItem = useCallback(
    (itemId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => removeItemFromCanvas(canvas, itemId),
        "Removed",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const removeProjectNote = useCallback(
    (noteId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => removeNoteFromCanvas(canvas, noteId),
        "Removed",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateNote = useCallback(
    (noteId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasNoteText(canvas, noteId, text),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateNoteSize = useCallback(
    (noteId: string, size: CanvasTextSize) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => updateCanvasNoteSize(canvas, noteId, size),
        "Note text size updated",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateLink = useCallback(
    (
      linkId: string,
      patch: Partial<Pick<CanvasLink, "title" | "description" | "url">>,
    ) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasLink(canvas, linkId, patch),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteLink = useCallback(
    (linkId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasLink(canvas, linkId),
        "Link deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateSection = useCallback(
    (
      sectionId: string,
      patch: Partial<Pick<CanvasSection, "title" | "color" | "collapsed">>,
    ) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasSection(canvas, sectionId, patch),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteSection = useCallback(
    (sectionId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasSection(canvas, sectionId),
        "Section deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteNote = useCallback(
    (noteId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasNote(canvas, noteId),
        "Note deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateTextElement = useCallback(
    (textElementId: string, text: string) => {
      if (!activeCanvas) return;
      updateCanvas(activeCanvas.id, (canvas) =>
        updateCanvasTextElementText(canvas, textElementId, text),
      );
    },
    [activeCanvas, updateCanvas],
  );

  const updateTextElementSize = useCallback(
    (textElementId: string, size: CanvasTextSize) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => updateCanvasTextElementSize(canvas, textElementId, size),
        "Text size updated",
      );
    },
    [activeCanvas, updateCanvas],
  );

  const deleteTextElement = useCallback(
    (textElementId: string) => {
      if (!activeCanvas) return;
      updateCanvas(
        activeCanvas.id,
        (canvas) => deleteCanvasTextElement(canvas, textElementId),
        "Text deleted",
      );
    },
    [activeCanvas, updateCanvas],
  );

  return {
    addNote,
    removeItem,
    removeProjectNote,
    updateNote,
    updateNoteSize,
    updateLink,
    deleteLink,
    updateSection,
    deleteSection,
    deleteNote,
    updateTextElement,
    updateTextElementSize,
    deleteTextElement,
  };
}
