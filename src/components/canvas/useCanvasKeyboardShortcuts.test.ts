import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Canvas } from "../../types";
import { useCanvasKeyboardShortcuts } from "./useCanvasKeyboardShortcuts";

function canvasFixture(): Canvas {
  return {
    id: "canvas-1",
    title: "Board",
    color: "#385d56",
    itemIds: [],
    positions: {},
    notes: [],
    edges: [],
    strokes: [],
    texts: [],
    links: [],
    sections: [],
  };
}

function shortcutHandlers() {
  return {
    setActiveTool: vi.fn(),
    clearSelectedObjects: vi.fn(),
    setSelectedEdgeId: vi.fn(),
    undoLastStroke: vi.fn(),
    duplicateSelectedObjects: vi.fn(),
    deleteSelectedObjects: vi.fn(),
    deleteEdge: vi.fn(),
    resetZoom: vi.fn(),
    fitCanvasContent: vi.fn(),
    zoomToSelection: vi.fn(),
  };
}

function renderShortcuts(
  overrides: Partial<Parameters<typeof useCanvasKeyboardShortcuts>[0]> = {},
) {
  const handlers = shortcutHandlers();
  const view = renderHook(() =>
    useCanvasKeyboardShortcuts({
      activeCanvas: canvasFixture(),
      activeStrokeCount: 0,
      editingEdgeId: null,
      selectedEdgeId: null,
      selectedObjectCount: 0,
      ...handlers,
      ...overrides,
    }),
  );
  return { handlers, view };
}

function pressKey(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key, ...init }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useCanvasKeyboardShortcuts", () => {
  it("resets the tool and selection on Escape", () => {
    const { handlers } = renderShortcuts();

    pressKey("Escape");

    expect(handlers.setActiveTool).toHaveBeenCalledWith("select");
    expect(handlers.clearSelectedObjects).toHaveBeenCalledTimes(1);
    expect(handlers.setSelectedEdgeId).toHaveBeenCalledWith(null);
  });

  it("undoes the last stroke with Cmd+Z only when strokes exist", () => {
    const empty = renderShortcuts({ activeStrokeCount: 0 });
    pressKey("z", { metaKey: true });
    expect(empty.handlers.undoLastStroke).not.toHaveBeenCalled();

    const withStrokes = renderShortcuts({ activeStrokeCount: 2 });
    pressKey("z", { metaKey: true });
    expect(withStrokes.handlers.undoLastStroke).toHaveBeenCalledTimes(1);
  });

  it("duplicates the selection with Cmd+D when objects are selected", () => {
    const { handlers } = renderShortcuts({ selectedObjectCount: 1 });

    pressKey("d", { metaKey: true });

    expect(handlers.duplicateSelectedObjects).toHaveBeenCalledTimes(1);
  });

  it("maps zoom and fit shortcuts", () => {
    const { handlers } = renderShortcuts({ selectedObjectCount: 1 });

    pressKey("0");
    pressKey("f");
    pressKey("s");

    expect(handlers.resetZoom).toHaveBeenCalledTimes(1);
    expect(handlers.fitCanvasContent).toHaveBeenCalledTimes(1);
    expect(handlers.zoomToSelection).toHaveBeenCalledTimes(1);
  });

  it("deletes the selected objects with Delete", () => {
    const { handlers } = renderShortcuts({ selectedObjectCount: 2 });

    pressKey("Delete");

    expect(handlers.deleteSelectedObjects).toHaveBeenCalledTimes(1);
    expect(handlers.deleteEdge).not.toHaveBeenCalled();
  });

  it("deletes the selected edge with Backspace when no objects are selected", () => {
    const { handlers } = renderShortcuts({ selectedEdgeId: "edge-1" });

    pressKey("Backspace");

    expect(handlers.deleteEdge).toHaveBeenCalledWith("edge-1");
  });

  it("ignores shortcuts while typing in form fields", () => {
    const { handlers } = renderShortcuts({ selectedObjectCount: 1 });
    const input = document.createElement("input");
    document.body.appendChild(input);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Delete", bubbles: true }),
    );

    expect(handlers.deleteSelectedObjects).not.toHaveBeenCalled();
    input.remove();
  });
});
