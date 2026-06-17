import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { makeItem } from "../../test/fixtures";
import type { ProjectTimelineEntry, ProjectTimelineGroup } from "./projectReview";
import { buildTimelineRows, ProjectReviewTimeline } from "./ProjectReviewTimeline";

const imageEntries: ProjectTimelineEntry[] = [
  {
    id: "image-alpha",
    kind: "image",
    title: "Alpha",
    detail: "Project image",
    timestamp: "2026-06-17T10:00:00.000Z",
    itemId: "alpha",
  },
  {
    id: "image-bravo",
    kind: "image",
    title: "Bravo",
    detail: "Project image",
    timestamp: "2026-06-17T10:01:00.000Z",
    itemId: "bravo",
  },
];

describe("ProjectReviewTimeline", () => {
  it("groups adjacent image entries into a single image-grid row", () => {
    const rows = buildTimelineRows([
      ...imageEntries,
      {
        id: "review-1",
        kind: "review",
        title: "Review 1",
        detail: "0 tagged Works",
        timestamp: "2026-06-17T11:00:00.000Z",
        reviewId: "review-1",
      },
      imageEntries[0],
    ]);

    expect(rows).toEqual([
      expect.objectContaining({ type: "image-grid" }),
      expect.objectContaining({ type: "entry" }),
      expect.objectContaining({ type: "image-grid" }),
    ]);
  });

  it("renders image and work grids and opens related items", () => {
    const onOpenItem = vi.fn();
    const onOpenReview = vi.fn();
    const timelineGroups: ProjectTimelineGroup[] = [
      {
        key: "2026-06-17",
        label: "Jun 17, 2026",
        entries: [
          ...imageEntries,
          {
            id: "work-project",
            kind: "work",
            title: "1 image",
            detail: "Added to work",
            timestamp: "2026-06-17T11:00:00.000Z",
            itemIds: ["alpha"],
          },
          {
            id: "review-1",
            kind: "review",
            title: "Review 1",
            detail: "0 tagged Works",
            timestamp: "2026-06-17T12:00:00.000Z",
            reviewId: "review-1",
          },
        ],
      },
    ];

    render(
      <ProjectReviewTimeline
        itemById={
          new Map([
            ["alpha", makeItem("alpha", { title: "Alpha" })],
            ["bravo", makeItem("bravo", { title: "Bravo" })],
          ])
        }
        timelineGroups={timelineGroups}
        thumbUrls={{
          alpha: "folio://thumb/alpha.jpg",
          bravo: "folio://thumb/bravo.jpg",
        }}
        setThumbUrls={vi.fn()}
        onOpenItem={onOpenItem}
        onOpenReview={onOpenReview}
      />,
    );

    const imageGrid = screen.getByLabelText("2 images in timeline");
    const workGrid = screen.getByLabelText("1 image added to work");

    fireEvent.doubleClick(within(imageGrid).getByRole("button", { name: /edit alpha/i }));
    fireEvent.keyDown(within(workGrid).getByRole("button", { name: /edit alpha/i }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("button", { name: /open review/i }));

    expect(onOpenItem).toHaveBeenCalledWith("alpha");
    expect(onOpenItem).toHaveBeenCalledTimes(2);
    expect(onOpenReview).toHaveBeenCalledWith("review-1");
  });
});
