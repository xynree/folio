import React from "react";
import type { FolioItem, ThumbnailUrls } from "../../types";
import { ITEM_STAGE_LABELS } from "../folio/constants";
import { basename } from "../folio/model";
import type { ItemDetailsOpenHandler } from "../folio/types";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import type { ProjectTimelineEntry, ProjectTimelineGroup } from "./projectReview";

type ProjectTimelineRow =
  | { type: "entry"; entry: ProjectTimelineEntry }
  | { type: "image-grid"; id: string; entries: ProjectTimelineEntry[] };

function kindLabel(entry: ProjectTimelineEntry): string {
  if (entry.kind === "work") return "Work";
  if (entry.kind === "review") return "Review";
  if (entry.kind === "note") return "Note";
  if (entry.kind === "relationship") return "Relationship";
  return "Image";
}

function itemTitle(item: FolioItem): string {
  return item.title || basename(item.path);
}

export function buildTimelineRows(
  entries: ProjectTimelineEntry[],
): ProjectTimelineRow[] {
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

export function ProjectReviewTimeline({
  itemById,
  timelineGroups,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
  onOpenReview,
}: {
  itemById: Map<string, FolioItem>;
  timelineGroups: ProjectTimelineGroup[];
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
                  return (
                    <TimelineImageGrid
                      key={row.id}
                      entries={row.entries}
                      itemById={itemById}
                      thumbUrls={thumbUrls}
                      setThumbUrls={setThumbUrls}
                      onOpenItem={onOpenItem}
                    />
                  );
                }

                return (
                  <TimelineEntry
                    key={row.entry.id}
                    entry={row.entry}
                    itemById={itemById}
                    thumbUrls={thumbUrls}
                    setThumbUrls={setThumbUrls}
                    onOpenItem={onOpenItem}
                    onOpenReview={onOpenReview}
                  />
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

function TimelineImageGrid({
  entries,
  itemById,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
}: {
  entries: ProjectTimelineEntry[];
  itemById: Map<string, FolioItem>;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpenItem: ItemDetailsOpenHandler;
}) {
  const imageItems = entries
    .map((entry) =>
      entry.itemId ? { entry, item: itemById.get(entry.itemId) } : null,
    )
    .filter(
      (value): value is { entry: ProjectTimelineEntry; item: FolioItem } =>
        Boolean(value?.item),
    );

  if (!imageItems.length) return null;

  const imageCountLabel = `${imageItems.length} ${
    imageItems.length === 1 ? "image" : "images"
  }`;

  return (
    <li className="project-timeline-entry project-timeline-image-grid-entry">
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
              onKeyDown={(event) => openItemFromKeyboard(event, item.id, onOpenItem)}
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

function TimelineEntry({
  entry,
  itemById,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
  onOpenReview,
}: {
  entry: ProjectTimelineEntry;
  itemById: Map<string, FolioItem>;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpenItem: ItemDetailsOpenHandler;
  onOpenReview: (reviewId: string) => void;
}) {
  const workGridItems = entry.kind === "work"
    ? (entry.itemIds ?? [])
        .map((itemId) => itemById.get(itemId))
        .filter((item): item is FolioItem => Boolean(item))
    : [];

  if (workGridItems.length) {
    return (
      <li className="project-timeline-entry project-timeline-image-grid-entry project-timeline-work-grid-entry">
        <span className="project-timeline-kind">{kindLabel(entry)}</span>
        <div className="project-timeline-copy">
          <strong>{entry.title}</strong>
          <span>{entry.detail}</span>
          <div
            className="project-timeline-image-grid"
            aria-label={`${entry.title} added to work`}
          >
            {workGridItems.map((item) => (
              <figure
                className="project-timeline-thumb"
                key={item.id}
                role="button"
                tabIndex={0}
                aria-label={`Edit ${itemTitle(item)}`}
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
                <figcaption>{itemTitle(item)}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </li>
    );
  }

  const item = entry.itemId ? itemById.get(entry.itemId) : null;
  const workItem = entry.kind === "work" && item ? item : null;
  return (
    <li
      className={`project-timeline-entry entry-${entry.kind} ${
        workItem ? "project-timeline-entry-with-thumb" : ""
      }`}
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
          ? (event) => openItemFromKeyboard(event, workItem.id, onOpenItem)
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
        {item?.stage ? <small>{ITEM_STAGE_LABELS[item.stage]}</small> : null}
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
}
