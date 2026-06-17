import { makeCanvas, makeItem, makeProject } from "../../test/fixtures";
import { buildProjectReview } from "./projectReview";

describe("project review model", () => {
  it("builds recap metrics and timeline entries from project data", () => {
    const project = makeProject("project-1", {
      imageIds: ["alpha", "bravo"],
      workItemIds: ["alpha"],
      boardIds: ["board-1"],
      updatedAt: "2026-06-18T12:00:00.000Z",
    });
    const items = [
      makeItem("alpha", {
        title: "Alpha",
        date: "2026-06-15T08:00:00.000Z",
        updatedAt: "2026-06-16T09:00:00.000Z",
      }),
      makeItem("bravo", {
        title: "Bravo",
        date: "2026-06-17T08:00:00.000Z",
        stage: "output",
        updatedAt: "2026-06-18T09:00:00.000Z",
      }),
    ];
    const canvases = [
      makeCanvas("board-1", {
        title: "Board 1",
        itemIds: ["alpha"],
        references: [
          {
            id: "ref-1",
            filename: "swatch.png",
            path: "projects/studio/boards/board-1/references/swatch.png",
            x: 0,
            y: 0,
            capturedAt: "2026-06-16T10:00:00.000Z",
          },
        ],
        notes: [
          {
            id: "note-1",
            text: "Revise values",
            x: 0,
            y: 0,
            createdAt: "2026-06-17T10:00:00.000Z",
          },
        ],
        edges: [
          {
            id: "edge-1",
            fromId: "alpha",
            toId: "ref-1",
            relationshipType: "version-of",
            createdAt: "2026-06-18T08:00:00.000Z",
          },
        ],
      }),
    ];

    const review = buildProjectReview(project, items, canvases);

    expect(review.recap).toMatchObject({
      imageCount: 2,
      workCount: 1,
      boardCount: 1,
      referenceCount: 1,
      outputCount: 1,
      activeDays: 4,
      firstImageDate: "2026-06-15T08:00:00.000Z",
      latestSavedDate: "2026-06-18T12:00:00.000Z",
    });
    expect(review.timelineGroups.flatMap((group) => group.entries)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "work", title: "Alpha" }),
        expect.objectContaining({ kind: "output", title: "Bravo" }),
        expect.objectContaining({ kind: "reference", title: "swatch.png" }),
        expect.objectContaining({ kind: "note", title: "Revise values" }),
        expect.objectContaining({
          kind: "relationship",
          detail: "version-of on Board 1",
        }),
      ]),
    );
  });
});
