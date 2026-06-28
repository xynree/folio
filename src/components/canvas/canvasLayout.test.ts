import { describe, expect, it } from "vitest";
import type { Canvas, FolioItem } from "../../types";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import {
  boardPreviewItemIds,
  buildCanvasObjectLayouts,
  canvasKindForItem,
  itemsByIdFromItems,
  itemsForCanvas,
  positionForCanvasItem,
  positionForCanvasLink,
  positionForCanvasNote,
  positionForCanvasSection,
  positionForCanvasText,
} from "./canvasLayout";

function item(id: string, overrides: Partial<FolioItem> = {}): FolioItem {
  return {
    id,
    path: `projects/studio-archive/images/${id}.png`,
    hash: id,
    type: "sketch",
    date: "2026-06-15T08:00:00.000Z",
    title: id,
    description: "",
    tagIds: [],
    ...overrides,
  };
}

function canvasFixture(): Canvas {
  return {
    id: "canvas-1",
    title: "Board",
    itemIds: ["item-1", "missing", "item-2"],
    positions: { "item-1": { x: 10, y: 20, width: 240, height: 280 } },
    notes: [{ id: "note-1", text: "Note", x: 30, y: 40, width: 260, height: 180 }],
    edges: [],
    texts: [{ id: "text-1", text: "Text", x: 70, y: 80, width: 320, height: 120 }],
    links: [
      {
        id: "link-1",
        title: "Example",
        url: "https://example.com/",
        capturedAt: "2026-06-15T08:00:00.000Z",
        x: 120,
        y: 130,
      },
    ],
    sections: [
      { id: "section-1", title: "Research", x: 5, y: 6, width: 500, height: 300 },
    ],
  };
}

describe("canvas layout helpers", () => {
  it("maps active canvas items and ignores stale ids", () => {
    const itemsById = itemsByIdFromItems([item("item-1"), item("item-2")]);

    expect(itemsForCanvas(canvasFixture(), itemsById).map((entry) => entry.id))
      .toEqual(["item-1", "item-2"]);
    expect(itemsForCanvas(null, itemsById)).toEqual([]);
  });

  it("deduplicates board preview item ids in board order", () => {
    expect(
      boardPreviewItemIds([
        { ...canvasFixture(), itemIds: ["item-1", "item-2", "item-3"] },
        { ...canvasFixture(), id: "canvas-2", itemIds: ["item-2", "item-4"] },
      ], 2),
    ).toEqual(["item-1", "item-2", "item-4"]);
  });

  it("resolves fallback item positions and drag preview positions", () => {
    const canvas = canvasFixture();

    expect(positionForCanvasItem(item("item-1"), 0, canvas, null)).toEqual({
      x: 10,
      y: 20,
      width: 240,
      height: 280,
    });
    expect(positionForCanvasItem(item("item-3"), 4, canvas, null)).toEqual({
      x: 80,
      y: 320,
      width: 162,
      height: 190,
    });
    expect(
      positionForCanvasItem(
        item("wide", { mediaWidth: 1200, mediaHeight: 600 }),
        5,
        canvas,
        null,
      ),
    ).toEqual({
      x: 270,
      y: 320,
      width: 190,
      height: 95,
    });
    expect(
      positionForCanvasItem(
        item("legacy-size", { mediaWidth: 4032, mediaHeight: 3024 }),
        6,
        {
          ...canvas,
          positions: {
            ...canvas.positions,
            "legacy-size": { x: 100, y: 110, width: 162, height: 190 },
          },
        },
        null,
      ),
    ).toEqual({
      x: 100,
      y: 110,
      width: 190,
      height: 143,
    });
    expect(
      positionForCanvasItem(item("item-3"), 4, canvas, {
        id: "item-3",
        kind: "item",
        position: { x: 500, y: 600 },
      }),
    ).toEqual({ x: 500, y: 600 });
    expect(
      canvasKindForItem(item("doc", {
        path: "projects/studio-archive/documents/doc.md",
        type: "text",
      })),
    ).toBe("document");
    expect(positionForCanvasItem(item("doc", { type: "text" }), 1, canvas, null))
      .toEqual({
        x: 270,
        y: 90,
        width: 190,
        height: 116,
      });
  });

  it("resolves drag preview positions for notes and text", () => {
    const canvas = canvasFixture();

    expect(
      positionForCanvasNote(canvas.notes[0], {
        id: "note-1",
        kind: "note",
        position: { x: 300, y: 310 },
      }),
    ).toEqual({ x: 300, y: 310 });
    expect(
      positionForCanvasText(canvas.texts?.[0] ?? { id: "missing", text: "", x: 0, y: 0 }, {
        id: "text-1",
        kind: "text",
        position: { x: 400, y: 410 },
      }),
    ).toEqual({ x: 400, y: 410 });
    expect(
      positionForCanvasLink(canvas.links?.[0] ?? {
        id: "missing",
        title: "",
        url: "https://example.com/",
        capturedAt: "",
        x: 0,
        y: 0,
      }, {
        id: "link-1",
        kind: "link",
        position: { x: 500, y: 510 },
      }),
    ).toEqual({ x: 500, y: 510 });
    expect(
      positionForCanvasSection(canvas.sections?.[0] ?? {
        id: "missing",
        title: "",
        x: 0,
        y: 0,
      }, {
        id: "section-1",
        kind: "section",
        position: { x: 600, y: 610 },
      }),
    ).toEqual({ x: 600, y: 610 });
  });

  it("builds object layouts for every canvas object kind", () => {
    const canvas = canvasFixture();
    const layouts = buildCanvasObjectLayouts({
      activeCanvas: canvas,
      activeItems: [item("item-1"), item("item-2")],
      activeProjectNotes: [],
      activeLinks: canvas.links ?? [],
      activeNotes: canvas.notes,
      activeSections: canvas.sections ?? [],
      activeTexts: canvas.texts ?? [],
      dragPreview: null,
    });

    expect(Array.from(layouts.keys())).toEqual([
      "item-1",
      "item-2",
      "note-1",
      "text-1",
      "link-1",
      "section-1",
    ]);
    expect(layouts.get("note-1")).toMatchObject({
      center: {
        x: CANVAS_WORLD_ORIGIN + 30 + 130,
        y: CANVAS_WORLD_ORIGIN + 40 + 90,
      },
      size: { width: 260, height: 180 },
    });
  });
});
