import React, { useEffect, useMemo, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { ArrowLeft, Plus, Tag, Trash2 } from "lucide-react";
import type {
  Canvas,
  FolioItem,
  Project,
  ProjectReviewDocument,
  ThumbnailUrls,
} from "../../types";
import { ITEM_STAGE_LABELS } from "../folio/constants";
import { basename } from "../folio/model";
import type { ItemDetailsOpenHandler } from "../folio/types";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { buildProjectReview, type ProjectTimelineEntry } from "./projectReview";

type ProjectTimelineRow =
  | { type: "entry"; entry: ProjectTimelineEntry }
  | { type: "image-grid"; id: string; entries: ProjectTimelineEntry[] };

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

function kindLabel(entry: ProjectTimelineEntry): string {
  if (entry.kind === "work") return "Work";
  if (entry.kind === "review") return "Review";
  if (entry.kind === "reference") return "Reference";
  if (entry.kind === "note") return "Note";
  if (entry.kind === "relationship") return "Relationship";
  return "Image";
}

function itemTitle(item: FolioItem): string {
  return item.title || basename(item.path);
}

function reviewWorkIntro(item: FolioItem): string {
  return `\n\n## ${itemTitle(item)}\n\n`;
}

function buildTimelineRows(entries: ProjectTimelineEntry[]): ProjectTimelineRow[] {
  const rows: ProjectTimelineRow[] = [];
  let imageEntries: ProjectTimelineEntry[] = [];

  const flushImageEntries = () => {
    if (!imageEntries.length) return;
    rows.push({
      type: "image-grid",
      id: `images-${imageEntries[0].id}-${imageEntries.length}`,
      entries: imageEntries,
    });
    imageEntries = [];
  };

  entries.forEach((entry) => {
    if (entry.kind === "image") {
      imageEntries.push(entry);
      return;
    }

    flushImageEntries();
    rows.push({ type: "entry", entry });
  });

  flushImageEntries();
  return rows;
}

function openItemFromKeyboard(
  event: React.KeyboardEvent<HTMLElement>,
  itemId: string,
  onOpenItem: ItemDetailsOpenHandler,
) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  event.stopPropagation();
  onOpenItem(itemId);
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
    ["References", String(review.recap.referenceCount)],
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

        <ProjectTimeline
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

export function ProjectReviewEditorPage({
  project,
  review,
  items,
  onBackToProjectReview,
  onBackToProjects,
  onUpdateReview,
  onDeleteReview,
}: {
  project: Project;
  review: ProjectReviewDocument;
  items: FolioItem[];
  onBackToProjectReview: () => void;
  onBackToProjects: () => void;
  onUpdateReview: (
    reviewId: string,
    patch: Partial<ProjectReviewDocument>,
  ) => void;
  onDeleteReview: (reviewId: string) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(review.title);
  const [markdownDraft, setMarkdownDraft] = useState(review.markdown);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const projectImageIds = useMemo(() => new Set(project.imageIds), [project.imageIds]);
  const works = useMemo(
    () =>
      project.workItemIds
        .map((itemId) => itemById.get(itemId))
        .filter((item): item is FolioItem => Boolean(item) && projectImageIds.has(item.id)),
    [itemById, project.workItemIds, projectImageIds],
  );
  const taggedWorkIds = useMemo(
    () => new Set(review.workItemIds),
    [review.workItemIds],
  );

  useEffect(() => {
    setTitleDraft(review.title);
    setMarkdownDraft(review.markdown);
  }, [review.id, review.markdown, review.title]);

  useEffect(() => {
    if (markdownDraft === review.markdown) return undefined;
    const timeout = window.setTimeout(() => {
      onUpdateReview(review.id, { markdown: markdownDraft });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [markdownDraft, onUpdateReview, review.id, review.markdown]);

  const saveTitle = () => {
    const nextTitle = titleDraft.trim() || "Untitled review";
    if (nextTitle === review.title) return;
    onUpdateReview(review.id, { title: nextTitle });
  };

  const toggleWorkTag = (item: FolioItem) => {
    const isTagged = taggedWorkIds.has(item.id);
    const nextWorkItemIds = isTagged
      ? review.workItemIds.filter((itemId) => itemId !== item.id)
      : [...review.workItemIds, item.id];
    const nextMarkdown =
      isTagged || markdownDraft.includes(`## ${itemTitle(item)}`)
        ? markdownDraft
        : `${markdownDraft.trimEnd()}${reviewWorkIntro(item)}`;

    setMarkdownDraft(nextMarkdown);
    onUpdateReview(review.id, {
      markdown: nextMarkdown,
      workItemIds: nextWorkItemIds,
    });
  };

  const deleteReview = () => {
    const confirmed = window.confirm(`Delete "${review.title}"?`);
    if (!confirmed) return;
    onDeleteReview(review.id);
  };

  return (
    <main className="review-editor-page" aria-label="Review editor">
      <div className="review-editor-titlebar">
        <button
          className="secondary-action"
          type="button"
          onClick={onBackToProjects}
        >
          <ButtonIcon icon={ArrowLeft} />
          Projects
        </button>
        <button
          className="secondary-action"
          type="button"
          onClick={onBackToProjectReview}
        >
          <ButtonIcon icon={ArrowLeft} />
          Review
        </button>
        <strong>{project.title}</strong>
      </div>

      <section className="review-editor-surface">
        <header className="project-review-editor-header">
          <label>
            <span>Review title</span>
            <input
              aria-label="Review title"
              value={titleDraft}
              onBlur={saveTitle}
              onChange={(event) => setTitleDraft(event.currentTarget.value)}
            />
          </label>
          <button
            className="secondary-action"
            type="button"
            onClick={deleteReview}
          >
            <ButtonIcon icon={Trash2} />
            Delete
          </button>
        </header>

        <div className="project-review-work-tags" aria-label="Tagged Works">
          {works.length ? (
            works.map((item) => (
              <button
                className={taggedWorkIds.has(item.id) ? "active" : ""}
                key={item.id}
                type="button"
                aria-pressed={taggedWorkIds.has(item.id)}
                onClick={() => toggleWorkTag(item)}
              >
                <ButtonIcon icon={Tag} />
                {itemTitle(item)}
              </button>
            ))
          ) : (
            <span>No Works marked yet</span>
          )}
        </div>

        <div className="project-markdown-editor" data-color-mode="light">
          <MDEditor
            height={520}
            preview="live"
            value={markdownDraft}
            onChange={(value) => setMarkdownDraft(value ?? "")}
          />
        </div>
      </section>
    </main>
  );
}

function ProjectTimeline({
  itemById,
  timelineGroups,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
  onOpenReview,
}: {
  itemById: Map<string, FolioItem>;
  timelineGroups: ReturnType<typeof buildProjectReview>["timelineGroups"];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpenItem: ItemDetailsOpenHandler;
  onOpenReview: (reviewId: string) => void;
}) {
  return (
    <div className="project-timeline">
      {timelineGroups.length ? (
        timelineGroups.map((group) => (
          <section className="project-timeline-group" key={group.key}>
            <h3>{group.label}</h3>
            <ol>
              {buildTimelineRows(group.entries).map((row) => {
                if (row.type === "image-grid") {
                  const imageItems = row.entries
                    .map((entry) =>
                      entry.itemId
                        ? { entry, item: itemById.get(entry.itemId) }
                        : null,
                    )
                    .filter(
                      (
                        value,
                      ): value is { entry: ProjectTimelineEntry; item: FolioItem } =>
                        Boolean(value?.item),
                    );

                  if (!imageItems.length) return null;
                  const imageCountLabel = `${imageItems.length} ${
                    imageItems.length === 1 ? "image" : "images"
                  }`;

                  return (
                    <li
                      className="project-timeline-entry project-timeline-image-grid-entry"
                      key={row.id}
                    >
                      <span className="project-timeline-kind">Images</span>
                      <div className="project-timeline-copy">
                        <strong>{imageCountLabel}</strong>
                        <span>Project images</span>
                        <div
                          className="project-timeline-image-grid"
                          aria-label={`${imageCountLabel} in timeline`}
                        >
                          {imageItems.map(({ entry, item }) => (
                            <figure
                              className="project-timeline-thumb"
                              key={entry.id}
                              role="button"
                              tabIndex={0}
                              aria-label={`Edit ${entry.title}`}
                              onDoubleClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onOpenItem(item.id);
                              }}
                              onKeyDown={(event) =>
                                openItemFromKeyboard(event, item.id, onOpenItem)
                              }
                            >
                              <LazyThumbnail
                                item={item}
                                thumbUrls={thumbUrls}
                                setThumbUrls={setThumbUrls}
                              />
                              <figcaption>{entry.title}</figcaption>
                            </figure>
                          ))}
                        </div>
                      </div>
                    </li>
                  );
                }

                const entry = row.entry;
                const item = entry.itemId ? itemById.get(entry.itemId) : null;
                const workItem = entry.kind === "work" && item ? item : null;
                return (
                  <li
                    className={`project-timeline-entry entry-${entry.kind} ${
                      workItem ? "project-timeline-entry-with-thumb" : ""
                    }`}
                    key={entry.id}
                    role={workItem ? "button" : undefined}
                    tabIndex={workItem ? 0 : undefined}
                    aria-label={workItem ? `Edit ${entry.title}` : undefined}
                    onDoubleClick={
                      workItem
                        ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onOpenItem(workItem.id);
                          }
                        : undefined
                    }
                    onKeyDown={
                      workItem
                        ? (event) =>
                            openItemFromKeyboard(event, workItem.id, onOpenItem)
                        : undefined
                    }
                  >
                    <span className="project-timeline-kind">{kindLabel(entry)}</span>
                    {workItem ? (
                      <span className="project-timeline-work-thumb" aria-hidden="true">
                        <LazyThumbnail
                          item={workItem}
                          thumbUrls={thumbUrls}
                          setThumbUrls={setThumbUrls}
                        />
                      </span>
                    ) : null}
                    <div className="project-timeline-copy">
                      <strong>{entry.title}</strong>
                      <span>{entry.detail}</span>
                      {item?.stage ? (
                        <small>{ITEM_STAGE_LABELS[item.stage]}</small>
                      ) : null}
                    </div>
                    <div className="project-timeline-actions">
                      {entry.reviewId ? (
                        <button
                          type="button"
                          onClick={() => onOpenReview(entry.reviewId as string)}
                        >
                          Open review
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
  );
}
