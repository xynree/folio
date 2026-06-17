import { describe, it, vi, expect } from "vitest";
import type { Canvas, FolioItem } from "../../types";
import {
  addItemsToCanvas,
  buildDateRange,
  canvasColorsForItem,
  createCanvas,
  getGaps,
  groupItemsByDate,
  itemCanUseDirectPreview,
  markCanvasSaved,
  mergeImportedItemsIntoProject,
  mergeItems,
  tagTextsForItem,
} from "./model";
import { makeData, makeProject } from "../../test/fixtures";

function item(id: string, date: string, tagIds: string[] = []): FolioItem {
  return {
    id,
    path: `items/2026/06_june/${id}.png`,
    hash: id,
    type: "sketch",
    date,
    title: id,
    description: "",
    tagIds,
  };
}

describe("folio model helpers", () => {
  it("builds date ranges with gaps from newest to oldest", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00"));

    const items = [
      item("older", "2026-06-12T08:00:00.000Z"),
      item("newer", "2026-06-15T08:00:00.000Z"),
    ];

    expect(buildDateRange(items)).toEqual([
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
      "2026-06-12",
    ]);
    expect(getGaps(items)).toBe(2);

    vi.useRealTimers();
  });

  it("keeps day groups ordered from older imports on the left to newer imports on the right", () => {
    const groups = groupItemsByDate([
      item("newest", "2026-06-15T10:00:00.000Z"),
      item("oldest", "2026-06-15T08:00:00.000Z"),
      item("middle", "2026-06-15T09:00:00.000Z"),
    ]);

    expect(groups.get("2026-06-15")?.map((entry) => entry.id)).toEqual([
      "oldest",
      "middle",
      "newest",
    ]);
  });

  it("deduplicates imported items by id", () => {
    expect(
      mergeItems(
        [item("one", "2026-06-15T08:00:00.000Z")],
        [
          { ...item("one", "2026-06-15T09:00:00.000Z"), title: "updated" },
          item("two", "2026-06-15T10:00:00.000Z"),
        ],
      ).map((entry) => entry.title),
    ).toEqual(["updated", "two"]);
  });

  it("merges imported items into a project image list", () => {
    const imported = {
      ...item("new-image", "2026-06-15T11:00:00.000Z"),
      path: "projects/studio/images/new-image.png",
    };
    const next = mergeImportedItemsIntoProject(
      makeData({
        projects: [
          makeProject("project-1", {
            imageIds: ["alpha"],
            updatedAt: "2026-06-15T09:00:00.000Z",
          }),
        ],
      }),
      [imported],
      "project-1",
      "2026-06-15T12:00:00.000Z",
    );

    expect(next.items.find((entry) => entry.id === "new-image")?.projectId).toBe(
      "project-1",
    );
    expect(next.projects[0].imageIds).toEqual(["alpha", "new-image"]);
    expect(next.projects[0].updatedAt).toBe("2026-06-15T12:00:00.000Z");
  });

  it("adds canvas items once and assigns drop-relative positions", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
    const canvas = createCanvas(0, "Board");
    const next = addItemsToCanvas(canvas, ["a", "b", "a"], { x: -40, y: 20 });

    expect(canvas.createdAt).toBe("2026-06-15T12:00:00.000Z");
    expect(canvas.updatedAt).toBe("2026-06-15T12:00:00.000Z");
    expect(next.itemIds).toEqual(["a", "b"]);
    expect(next.positions).toEqual({
      a: { x: -40, y: 20 },
      b: { x: 144, y: 20 },
    });
    vi.useRealTimers();
  });

  it("marks board saves with an updated timestamp", () => {
    const next = markCanvasSaved(
      {
        ...createCanvas(0, "Board"),
        createdAt: "2026-06-14T12:00:00.000Z",
        updatedAt: "2026-06-14T12:30:00.000Z",
      },
      "2026-06-15T12:00:00.000Z",
    );

    expect(next.createdAt).toBe("2026-06-14T12:00:00.000Z");
    expect(next.updatedAt).toBe("2026-06-15T12:00:00.000Z");
  });

  it("maps tags and board membership for archive display", () => {
    const entry = item("one", "2026-06-15T08:00:00.000Z", ["tag-a", "tag-b"]);
    const canvases: Canvas[] = [
      { ...createCanvas(0, "One"), color: "#111111", itemIds: ["one"] },
      { ...createCanvas(1, "Two"), color: "#222222", itemIds: ["other"] },
    ];

    expect(
      tagTextsForItem(entry, [
        { id: "tag-a", text: "sketch" },
        { id: "tag-b", text: "ref" },
      ]),
    ).toEqual(["sketch", "ref"]);
    expect(canvasColorsForItem("one", canvases)).toEqual(["#111111"]);
  });

  it("uses direct previews only for available visual archive files", () => {
    expect(
      itemCanUseDirectPreview(item("image", "2026-06-15T08:00:00.000Z")),
    ).toBe(true);
    expect(
      itemCanUseDirectPreview({
        ...item("missing", "2026-06-15T08:00:00.000Z"),
        missing: true,
      }),
    ).toBe(false);
    expect(
      itemCanUseDirectPreview({
        ...item("song", "2026-06-15T08:00:00.000Z"),
        path: "items/2026/06_june/song.mp3",
        type: "music",
      }),
    ).toBe(false);
  });
});
