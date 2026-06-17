import { describe, expect, it } from "vitest";
import { makeCanvas, makeItem } from "../../test/fixtures";
import { canvasObjectViews } from "./canvasObjects";

describe("canvas object view helpers", () => {
  it("builds renderable object view models in layer order", () => {
    const canvas = makeCanvas("board-1", {
      itemIds: ["image", "doc"],
      positions: { image: { x: 10, y: 20 }, doc: { x: 30, y: 40 } },
    });
    const views = canvasObjectViews({
      canvas,
      items: [
        makeItem("image", { title: "Image" }),
        makeItem("doc", {
          title: "Brief",
          type: "text",
          path: "projects/studio-archive/documents/brief.md",
        }),
      ],
      links: [
        {
          id: "link-1",
          title: "Example",
          url: "https://example.com/",
          capturedAt: "2026-06-17T08:00:00.000Z",
          x: 50,
          y: 60,
        },
      ],
      notes: [{ id: "note-1", text: "", x: 70, y: 80 }],
      sections: [{ id: "section-1", title: "", x: 0, y: 0, width: 400, height: 300 }],
      texts: [{ id: "text-1", text: "Caption", x: 90, y: 100 }],
      dragPreview: null,
    });

    expect(views.map((view) => [view.id, view.kind, view.title])).toEqual([
      ["section-1", "section", "Section"],
      ["image", "item", "Image"],
      ["doc", "document", "Brief"],
      ["link-1", "link", "Example"],
      ["note-1", "note", "Note"],
      ["text-1", "text", "Caption"],
    ]);
    expect(views.every((view) => view.connectable && view.selectable)).toBe(true);
  });
});
