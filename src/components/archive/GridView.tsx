import React, { useMemo, useState } from "react";
import { Tag as TagIcon } from "lucide-react";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import type { GridTagFilter, ItemOpenHandler } from "../folio/types";
import { parseTimestamp } from "../folio/dates";
import { basename, canvasColorsForItem } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { EmptyState } from "../shared/EmptyState";
import { ItemCard } from "./ItemCard";

type GridSortMode = "recent" | "oldest" | "title";

const itemLabel = (item: FolioItem) => item.title || basename(item.path);

export function GridView({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  tagFilter,
  setTagFilter,
  selectedItemIds,
  workItemIds = [],
  onBackgroundClick,
  onDragStart,
  onItemOpen,
  onEditItem,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  tagFilter: GridTagFilter;
  setTagFilter: React.Dispatch<React.SetStateAction<GridTagFilter>>;
  selectedItemIds: string[];
  workItemIds?: string[];
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
  onEditItem: (itemId: string) => void;
}) {
  const [sortMode, setSortMode] = useState<GridSortMode>("recent");
  const filteredItems = useMemo(
    () =>
      tagFilter === "all"
        ? items
        : items.filter((item) => item.tagIds.includes(tagFilter)),
    [items, tagFilter],
  );
  const sortedItems = useMemo(() => {
    const nextItems = [...filteredItems];
    nextItems.sort((a, b) => {
      if (sortMode === "title") {
        return (
          itemLabel(a).localeCompare(itemLabel(b), undefined, {
            sensitivity: "base",
          }) || b.date.localeCompare(a.date)
        );
      }

      const dateSort =
        sortMode === "recent"
          ? parseTimestamp(b.date) - parseTimestamp(a.date)
          : parseTimestamp(a.date) - parseTimestamp(b.date);

      return (
        dateSort ||
        itemLabel(a).localeCompare(itemLabel(b), undefined, {
          sensitivity: "base",
        })
      );
    });
    return nextItems;
  }, [filteredItems, sortMode]);
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const workItemSet = useMemo(() => new Set(workItemIds), [workItemIds]);

  return (
    <section
      className="view-scroller grid-view"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onBackgroundClick();
      }}
    >
      <div className="grid-toolbar">
        <div className="filter-bar" aria-label="Tags">
          <button
            className={tagFilter === "all" ? "active" : ""}
            type="button"
            onClick={() => setTagFilter("all")}
          >
            <ButtonIcon icon={TagIcon} />
            All
          </button>
          {tags.map((tag) => (
            <button
              className={tag.id === tagFilter ? "active" : ""}
              key={tag.id}
              type="button"
              onClick={() => setTagFilter(tag.id)}
            >
              <ButtonIcon icon={TagIcon} />
              {tag.text}
            </button>
          ))}
        </div>

        <label className="grid-sort-control">
          <span>Sort</span>
          <select
            aria-label="Sort grid items"
            value={sortMode}
            onChange={(event) =>
              setSortMode(event.currentTarget.value as GridSortMode)
            }
          >
            <option value="recent">Most recent</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Title A-Z</option>
          </select>
        </label>
      </div>

      {sortedItems.length ? (
        <div
          className="item-grid"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onBackgroundClick();
          }}
        >
          {sortedItems.map((item) => (
            <ItemCard
              item={item}
              tags={tags}
              canvasColors={canvasColorsForItem(item.id, canvases)}
              key={item.id}
              thumbUrls={thumbUrls}
              setThumbUrls={setThumbUrls}
              isSelected={selectedSet.has(item.id)}
              isWork={workItemSet.has(item.id)}
              onDragStart={onDragStart}
              onOpen={(itemId, event) =>
                onItemOpen(itemId, event, sortedItems, true)
              }
              onEdit={onEditItem}
            />
          ))}
        </div>
      ) : (
        <EmptyState label="No items in this view" />
      )}
    </section>
  );
}
