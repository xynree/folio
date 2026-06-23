import { describe, expect, it } from "vitest";
import {
  removeLegacyCanvasReferences,
  repairBrokenLinks,
  repairLegacyOutputStages,
  stripLegacyCanvasReferences,
  validateFolioSchema,
} from "./schema.helpers";
import { makeCanvas, makeItem, makeProject } from "../test/fixtures";
import type { Canvas } from "../types";

describe("validateFolioSchema", () => {
  it("accepts a well-formed data file", () => {
    expect(() =>
      validateFolioSchema("folio.json", { version: 1, items: [] }, "items", 1),
    ).not.toThrow();
  });

  it("rejects a wrong schema version", () => {
    expect(() =>
      validateFolioSchema("folio.json", { version: 2, items: [] }, "items", 1),
    ).toThrow("folio.json is not a valid Folio v1 data file.");
  });

  it("rejects a missing collection array", () => {
    expect(() =>
      validateFolioSchema("tags.json", { version: 1 }, "tags", 1),
    ).toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => validateFolioSchema("tags.json", null, "tags", 1)).toThrow();
  });
});

describe("stripLegacyCanvasReferences", () => {
  it("removes the obsolete references field without mutating the source", () => {
    const canvas = {
      ...makeCanvas("board-1"),
      references: ["legacy"],
    } as Canvas & { references?: unknown };

    const result = stripLegacyCanvasReferences(canvas) as Canvas & {
      references?: unknown;
    };

    expect("references" in result).toBe(false);
    expect("references" in canvas).toBe(true);
  });
});

describe("removeLegacyCanvasReferences", () => {
  it("reports no change when no canvas carries references", () => {
    const canvases = [makeCanvas("board-1"), makeCanvas("board-2")];
    const result = removeLegacyCanvasReferences(canvases);
    expect(result.changed).toBe(false);
    expect(result.canvases[0]).toBe(canvases[0]);
  });

  it("strips references and reports a change", () => {
    const legacy = {
      ...makeCanvas("board-1"),
      references: ["x"],
    } as Canvas & { references?: unknown };
    const result = removeLegacyCanvasReferences([
      legacy,
      makeCanvas("board-2"),
    ]);
    expect(result.changed).toBe(true);
    expect("references" in result.canvases[0]).toBe(false);
  });
});

describe("repairLegacyOutputStages", () => {
  it("rewrites the output stage to final in place", () => {
    const items = [
      makeItem("alpha", { stage: "output" as never }),
      makeItem("bravo", { stage: "final" }),
    ];
    const changed = repairLegacyOutputStages(items);
    expect(changed).toBe(true);
    expect(items[0].stage).toBe("final");
  });

  it("reports no change when there are no legacy stages", () => {
    const items = [makeItem("alpha", { stage: "final" })];
    expect(repairLegacyOutputStages(items)).toBe(false);
  });
});

describe("repairBrokenLinks", () => {
  it("reports no change when all references are valid", () => {
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const projects = [makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] })];
    const canvases = [makeCanvas("board-1", { projectId: "project-1", itemIds: ["alpha"], positions: { alpha: { x: 0, y: 0 } } })];
    const result = repairBrokenLinks({ items, projects, canvases });
    expect(result.changed).toBe(false);
    expect(result.items[0]).toBe(items[0]);
    expect(result.projects[0]).toBe(projects[0]);
    expect(result.canvases[0]).toBe(canvases[0]);
  });

  it("clears item.projectId when the referenced project does not exist", () => {
    const items = [makeItem("alpha", { projectId: "gone" })];
    const result = repairBrokenLinks({ items, projects: [], canvases: [] });
    expect(result.changed).toBe(true);
    expect(result.items[0].projectId).toBeUndefined();
  });

  it("removes dangling imageIds from a project", () => {
    const project = makeProject("project-1", { imageIds: ["alpha", "missing"] });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const result = repairBrokenLinks({ items, projects: [project], canvases: [] });
    expect(result.changed).toBe(true);
    expect(result.projects[0].imageIds).toEqual(["alpha"]);
  });

  it("removes workItemIds that are no longer in imageIds", () => {
    const project = makeProject("project-1", {
      imageIds: ["alpha"],
      workItemIds: ["alpha", "orphan"],
    });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const result = repairBrokenLinks({ items, projects: [project], canvases: [] });
    expect(result.changed).toBe(true);
    expect(result.projects[0].workItemIds).toEqual(["alpha"]);
  });

  it("removes dangling boardIds from a project", () => {
    const project = makeProject("project-1", { boardIds: ["board-1", "gone-board"] });
    const canvases = [makeCanvas("board-1", { projectId: "project-1" })];
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const result = repairBrokenLinks({ items, projects: [project], canvases });
    expect(result.changed).toBe(true);
    expect(result.projects[0].boardIds).toEqual(["board-1"]);
  });

  it("removes dangling itemIds from a canvas", () => {
    const canvas = makeCanvas("board-1", { itemIds: ["alpha", "missing"] });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const project = makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] });
    const result = repairBrokenLinks({ items, projects: [project], canvases: [canvas] });
    expect(result.changed).toBe(true);
    expect(result.canvases[0].itemIds).toEqual(["alpha"]);
  });

  it("removes orphaned position keys after itemIds are cleaned", () => {
    const canvas = makeCanvas("board-1", {
      itemIds: ["alpha", "missing"],
      positions: { alpha: { x: 10, y: 20 }, missing: { x: 0, y: 0 } },
    });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const project = makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] });
    const result = repairBrokenLinks({ items, projects: [project], canvases: [canvas] });
    expect(result.changed).toBe(true);
    expect(Object.keys(result.canvases[0].positions)).toEqual(["alpha"]);
  });

  it("removes canvas edges where fromId does not resolve", () => {
    const canvas = makeCanvas("board-1", {
      itemIds: ["alpha"],
      edges: [
        { id: "e1", fromId: "ghost", toId: "alpha" },
        { id: "e2", fromId: "alpha", toId: "alpha" },
      ],
    });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const project = makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] });
    const result = repairBrokenLinks({ items, projects: [project], canvases: [canvas] });
    expect(result.changed).toBe(true);
    expect(result.canvases[0].edges).toHaveLength(1);
    expect(result.canvases[0].edges[0].id).toBe("e2");
  });

  it("removes canvas edges where toId does not resolve", () => {
    const canvas = makeCanvas("board-1", {
      itemIds: ["alpha"],
      edges: [{ id: "e1", fromId: "alpha", toId: "ghost" }],
    });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const project = makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] });
    const result = repairBrokenLinks({ items, projects: [project], canvases: [canvas] });
    expect(result.changed).toBe(true);
    expect(result.canvases[0].edges).toHaveLength(0);
  });

  it("keeps edges that connect to canvas notes or text elements", () => {
    const canvas = makeCanvas("board-1", {
      itemIds: ["alpha"],
      notes: [{ id: "note-1", text: "hello", x: 0, y: 0 }],
      edges: [{ id: "e1", fromId: "alpha", toId: "note-1" }],
    });
    const items = [makeItem("alpha", { projectId: "project-1" })];
    const project = makeProject("project-1", { imageIds: ["alpha"], boardIds: ["board-1"] });
    const result = repairBrokenLinks({ items, projects: [project], canvases: [canvas] });
    expect(result.changed).toBe(false);
    expect(result.canvases[0].edges).toHaveLength(1);
  });
});
