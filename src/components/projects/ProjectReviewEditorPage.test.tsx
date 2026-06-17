import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { makeItem, makeProject } from "../../test/fixtures";
import type { ProjectReviewDocument } from "../../types";
import { ProjectReviewEditorPage } from "./ProjectReviewEditorPage";

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

function renderEditor({
  project = makeProject("project-1", {
    title: "Drawing",
    imageIds: ["alpha", "bravo"],
    workItemIds: [],
  }),
  review = makeReview(),
} = {}) {
  vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({
    alpha: "folio://thumb/alpha.jpg",
    bravo: "folio://thumb/bravo.jpg",
  });
  const props = {
    project,
    review,
    items: [
      makeItem("alpha", { title: "Alpha" }),
      makeItem("bravo", { title: "Bravo" }),
    ],
    thumbUrls: {
      alpha: "folio://thumb/alpha.jpg",
      bravo: "folio://thumb/bravo.jpg",
    },
    setThumbUrls: vi.fn(),
    onBackToProjectReview: vi.fn(),
    onUpdateReview: vi.fn(),
    onDeleteReview: vi.fn(),
  };

  render(<ProjectReviewEditorPage {...props} />);
  return props;
}

describe("ProjectReviewEditorPage", () => {
  it("selects project images when no Works are marked", () => {
    const props = renderEditor();

    const workSelector = screen.getByLabelText("Review Works");
    expect(within(workSelector).queryByText("No Works marked yet")).toBeNull();

    fireEvent.click(
      within(workSelector).getByRole("button", {
        name: /attach alpha to review/i,
      }),
    );

    expect(props.onUpdateReview).toHaveBeenCalledWith("review-1", {
      markdown: expect.stringContaining("## Alpha"),
      workItemIds: ["alpha"],
    });
  });

  it("uses marked Works as the selector candidates", () => {
    renderEditor({
      project: makeProject("project-1", {
        imageIds: ["alpha", "bravo"],
        workItemIds: ["bravo"],
      }),
    });

    const workSelector = screen.getByLabelText("Review Works");

    expect(
      within(workSelector).queryByRole("button", {
        name: /attach alpha to review/i,
      }),
    ).toBeNull();
    expect(
      within(workSelector).getByRole("button", {
        name: /attach bravo to review/i,
      }),
    ).not.toBeNull();
  });

  it("toggles the markdown editor fullscreen command", () => {
    renderEditor();

    fireEvent.click(screen.getByRole("button", { name: /maximize editor/i }));
    expect(screen.getByRole("button", { name: /minimize editor/i })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /minimize editor/i }));
    expect(screen.getByRole("button", { name: /maximize editor/i })).not.toBeNull();
  });

  it("saves title changes on blur and confirms deletion", async () => {
    const props = renderEditor();

    fireEvent.change(screen.getByLabelText("Review title"), {
      target: { value: "Updated review" },
    });
    fireEvent.blur(screen.getByLabelText("Review title"));
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() =>
      expect(props.onUpdateReview).toHaveBeenCalledWith("review-1", {
        title: "Updated review",
      }),
    );
    expect(props.onDeleteReview).toHaveBeenCalledWith("review-1");
  });
});
