import React, { useMemo } from "react";
import { ExternalLink, Star } from "lucide-react";
import type { Canvas, FolioItem, Project } from "../../types";
import { ITEM_STAGE_LABELS } from "../folio/constants";
import { ButtonIcon } from "../shared/ButtonIcon";
import { buildProjectReview, type ProjectTimelineEntry } from "./projectReview";

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

function kindLabel(entry: ProjectTimelineEntry): string {
  if (entry.kind === "work") return "Work";
  if (entry.kind === "output") return "Output";
  if (entry.kind === "reference") return "Reference";
  if (entry.kind === "note") return "Note";
  if (entry.kind === "relationship") return "Relationship";
  return "Image";
}

export function ProjectReviewView({
  project,
  items,
  canvases,
  onOpenBoard,
  onPromoteToOutput,
}: {
  project: Project;
  items: FolioItem[];
  canvases: Canvas[];
  onOpenBoard: (boardId: string) => void;
  onPromoteToOutput: (itemId: string) => void;
}) {
  const review = useMemo(
    () => buildProjectReview(project, items, canvases),
    [canvases, items, project],
  );
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const metrics = [
    ["Images", String(review.recap.imageCount)],
    ["Works", String(review.recap.workCount)],
    ["Boards", String(review.recap.boardCount)],
    ["References", String(review.recap.referenceCount)],
    ["Outputs", String(review.recap.outputCount)],
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
      </header>

      <dl className="project-review-recap">
        {metrics.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="project-timeline">
        {review.timelineGroups.length ? (
          review.timelineGroups.map((group) => (
            <section className="project-timeline-group" key={group.key}>
              <h3>{group.label}</h3>
              <ol>
                {group.entries.map((entry) => {
                  const item = entry.itemId ? itemById.get(entry.itemId) : null;
                  return (
                    <li className={`project-timeline-entry entry-${entry.kind}`} key={entry.id}>
                      <span className="project-timeline-kind">{kindLabel(entry)}</span>
                      <div className="project-timeline-copy">
                        <strong>{entry.title}</strong>
                        <span>{entry.detail}</span>
                        {item?.stage ? (
                          <small>{ITEM_STAGE_LABELS[item.stage]}</small>
                        ) : null}
                      </div>
                      <div className="project-timeline-actions">
                        {entry.boardId ? (
                          <button
                            type="button"
                            onClick={() => onOpenBoard(entry.boardId as string)}
                          >
                            <ButtonIcon icon={ExternalLink} />
                            Open on board
                          </button>
                        ) : null}
                        {entry.itemId && item?.stage !== "output" ? (
                          <button
                            type="button"
                            onClick={() => onPromoteToOutput(entry.itemId as string)}
                          >
                            <ButtonIcon icon={Star} />
                            Promote to output
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))
        ) : (
          <div className="project-review-empty">No project activity yet</div>
        )}
      </div>
    </section>
  );
}
