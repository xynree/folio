import React, { useMemo } from "react";
import { Plus } from "lucide-react";
import type { Canvas, FolioItem, Project, ThumbnailUrls } from "../../types";
import type { ItemDetailsOpenHandler } from "../folio/types";
import { ButtonIcon } from "../shared/ButtonIcon";
import { buildProjectReview } from "./projectReview";
import { ProjectReviewTimeline } from "./ProjectReviewTimeline";

function formatShortDate(value: string | null): string {
  if (!value) return "None";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatReviewTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function ProjectReviewView({
  project,
  items,
  canvases,
  thumbUrls,
  setThumbUrls,
  onCreateReview,
  onOpenItem,
  onOpenReview,
}: {
  project: Project;
  items: FolioItem[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onCreateReview: () => void;
  onOpenItem: ItemDetailsOpenHandler;
  onOpenReview: (reviewId: string) => void;
}) {
  const reviews = project.reviews ?? [];
  const review = useMemo(
    () => buildProjectReview(project, items, canvases),
    [canvases, items, project],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const metrics = [
    ["Works", String(review.recap.workCount)],
    ["Reviews", String(review.recap.reviewCount)],
    ["Images", String(review.recap.imageCount)],
    ["Boards", String(review.recap.boardCount)],
    ["Active days", String(review.recap.activeDays)],
    ["First image", formatShortDate(review.recap.firstImageDate)],
    ["Latest saved", formatShortDate(review.recap.latestSavedDate)],
  ];

  return (
    <section className="project-review" aria-label="Project review">
      <header className="project-review-header">
        <div>
          <p>Project review</p>
          <h2>{project.title}</h2>
        </div>
        <button className="primary-action" type="button" onClick={onCreateReview}>
          <ButtonIcon icon={Plus} />
          New review
        </button>
      </header>

      <dl className="project-review-recap">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="project-review-overview">
        <aside className="project-review-list" aria-label="Project reviews">
          {reviews.length ? (
            reviews.map((projectReview) => (
              <button
                key={projectReview.id}
                type="button"
                onClick={() => onOpenReview(projectReview.id)}
              >
                <strong>{projectReview.title}</strong>
                <span>{formatReviewTimestamp(projectReview.updatedAt)}</span>
              </button>
            ))
          ) : (
            <div className="project-review-empty">No reviews yet</div>
          )}
        </aside>

        <ProjectReviewTimeline
          itemById={itemById}
          timelineGroups={review.timelineGroups}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
          onOpenItem={onOpenItem}
          onOpenReview={onOpenReview}
        />
      </div>
    </section>
  );
}
