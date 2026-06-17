import { makeItem, makeProject } from "../../test/fixtures";
import type { ProjectReviewDocument } from "../../types";
import { reviewCandidateItems, reviewWorkPatch } from "./ProjectReviewEditorPage.helpers";

function makeReview(overrides: Partial<ProjectReviewDocument> = {}): ProjectReviewDocument {
  return {
    id: "review-1",
    title: "Review 1",
    markdown: "# Review\n\n",
    workItemIds: [],
    createdAt: "2026-06-17T10:00:00.000Z",
    updatedAt: "2026-06-17T10:00:00.000Z",
    ...overrides,
  };
}

describe("ProjectReviewEditorPage helpers", () => {
  it("uses marked Works first and falls back to all project images", () => {
    const alpha = makeItem("alpha", { title: "Alpha" });
    const bravo = makeItem("bravo", { title: "Bravo" });
    const itemById = new Map([
      [alpha.id, alpha],
      [bravo.id, bravo],
    ]);

    expect(
      reviewCandidateItems(
        makeProject("project-1", {
          imageIds: ["alpha", "bravo"],
          workItemIds: ["bravo"],
        }),
        itemById,
      ).map((item) => item.id),
    ).toEqual(["bravo"]);

    expect(
      reviewCandidateItems(
        makeProject("project-1", {
          imageIds: ["alpha", "bravo"],
          workItemIds: [],
        }),
        itemById,
      ).map((item) => item.id),
    ).toEqual(["alpha", "bravo"]);
  });

  it("adds review headings once and removes attached work ids", () => {
    const alpha = makeItem("alpha", { title: "Alpha" });
    const review = makeReview();

    const added = reviewWorkPatch(review, review.markdown, alpha);

    expect(added.workItemIds).toEqual(["alpha"]);
    expect(added.markdown).toContain("## Alpha");

    const repeated = reviewWorkPatch(review, added.markdown, alpha);

    expect(repeated.markdown.match(/## Alpha/g)).toHaveLength(1);

    const removed = reviewWorkPatch(
      makeReview({ workItemIds: ["alpha"] }),
      repeated.markdown,
      alpha,
    );

    expect(removed.workItemIds).toEqual([]);
    expect(removed.markdown).toBe(repeated.markdown);
  });
});
