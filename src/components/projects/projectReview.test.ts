import { makeCanvas, makeItem, makeProject } from "../../test/fixtures";
import { buildProjectReview } from "./projectReview";

describe("project review model", () => {
  it("builds recap metrics and timeline entries from project data", () => {
    const project = makeProject("project-1", {
      imageIds: ["alpha", "bravo"],
      workItemIds: ["alpha"],
      boardIds: ["board-1"],
      reviews: [
        {
          id: "review-1",
          title: "Week 1 review",
          markdown: "# Week 1\n\nAlpha is getting stronger.",
          workItemIds: ["alpha"],
          createdAt: "2026-06-18T10:00:00.000Z",
          updatedAt: "2026-06-18T12:00:00.000Z",
        },
      ],
      updatedAt: "2026-06-18T12:00:00.000Z",
      workUpdatedAt: "2026-06-19T09:00:00.000Z",
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
        stage: "final",
        updatedAt: "2026-06-18T09:00:00.000Z",
      }),
    ];
    const canvases = [
      makeCanvas("board-1", {
        title: "Board 1",
        itemIds: ["alpha"],
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
            toId: "note-1",
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
      reviewCount: 1,
      activeDays: 5,
      firstImageDate: "2026-06-15T08:00:00.000Z",
      latestSavedDate: "2026-06-19T09:00:00.000Z",
    });
    expect(review.timelineGroups.flatMap((group) => group.entries)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "work",
          title: "1 image",
          detail: "Added to work",
          timestamp: "2026-06-19T09:00:00.000Z",
          itemIds: ["alpha"],
        }),
        expect.objectContaining({ kind: "review", title: "Week 1 review" }),
        expect.objectContaining({ kind: "note", title: "Revise values" }),
        expect.objectContaining({
          kind: "relationship",
          detail: "version-of on Board 1",
        }),
      ]),
    );
    expect(
      review.timelineGroups
        .flatMap((group) => group.entries)
        .some((entry) => entry.kind === "image" && entry.itemId === "alpha"),
    ).toBe(false);
    expect(review.timelineGroups[0].entries[0]).toMatchObject({
      kind: "work",
      detail: "Added to work",
    });
  });
});
