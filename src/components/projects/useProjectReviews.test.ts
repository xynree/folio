import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useProjectReviews } from "./useProjectReviews";
import { makeData, makeProject } from "../../test/fixtures";
import type { DataUpdater } from "../folio/types";
import type { FolioData } from "../../types";

function setup(options?: {
  activeReviewId?: string | null;
  setActiveReviewId?: (reviewId: string | null) => void;
  projectOverrides?: Parameters<typeof makeProject>[1];
}) {
  const project = makeProject("project-1", options?.projectOverrides);
  const data = makeData({ projects: [project] });
  const commits: Array<{ next: FolioData; message?: string }> = [];
  const commitData = vi.fn((updater: DataUpdater, message?: string) => {
    commits.push({ next: updater(data), message });
  });
  const setActiveReviewId = options?.setActiveReviewId ?? vi.fn();

  const { result } = renderHook(() =>
    useProjectReviews({
      activeProject: project,
      commitData,
      activeReviewId: options?.activeReviewId ?? null,
      setActiveReviewId,
    }),
  );

  return { result, commits, commitData, setActiveReviewId, project };
}

describe("useProjectReviews", () => {
  it("creates a review, prepends it, and selects it", () => {
    const setActiveReviewId = vi.fn();
    const { result, commits } = setup({ setActiveReviewId });

    const review = result.current.createProjectReview();

    expect(review.title).toBe("Review 1");
    expect(setActiveReviewId).toHaveBeenCalledWith(review.id);
    const savedReviews = commits[0].next.projects[0].reviews;
    expect(savedReviews[0].id).toBe(review.id);
    expect(commits[0].message).toBe("Review created");
  });

  it("throws when there is no active project", () => {
    const { result } = renderHook(() =>
      useProjectReviews({
        activeProject: null,
        commitData: vi.fn(),
        activeReviewId: null,
        setActiveReviewId: vi.fn(),
      }),
    );

    expect(() => result.current.createProjectReview()).toThrow(
      "No active project is open.",
    );
  });

  it("updates a review and keeps the prior title when blank", () => {
    const existing = {
      id: "review-1",
      title: "Original",
      markdown: "body",
      workItemIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const { result, commits } = setup({
      projectOverrides: { reviews: [existing] },
    });

    result.current.updateProjectReview("review-1", { title: "   " });

    const updated = commits[0].next.projects[0].reviews[0];
    expect(updated.title).toBe("Original");
    expect(updated.updatedAt).not.toBe("2026-01-01T00:00:00.000Z");
  });

  it("deletes a review and clears the active id when it was open", () => {
    const setActiveReviewId = vi.fn();
    const existing = {
      id: "review-1",
      title: "Original",
      markdown: "body",
      workItemIds: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const { result, commits } = setup({
      activeReviewId: "review-1",
      setActiveReviewId,
      projectOverrides: { reviews: [existing] },
    });

    result.current.deleteProjectReview("review-1");

    expect(commits[0].next.projects[0].reviews).toHaveLength(0);
    expect(commits[0].message).toBe("Review deleted");
    expect(setActiveReviewId).toHaveBeenCalledWith(null);
  });

  it("does not clear the active id when deleting a different review", () => {
    const setActiveReviewId = vi.fn();
    const { result } = setup({
      activeReviewId: "review-other",
      setActiveReviewId,
      projectOverrides: { reviews: [] },
    });

    result.current.deleteProjectReview("review-1");

    expect(setActiveReviewId).not.toHaveBeenCalled();
  });
});
