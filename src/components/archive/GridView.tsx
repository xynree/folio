import React, { useMemo } from "react";
import { Tag as TagIcon } from "lucide-react";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import type { GridTagFilter, ItemOpenHandler } from "../folio/types";
import { canvasColorsForItem } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { EmptyState } from "../shared/EmptyState";
import { ItemCard } from "./ItemCard";

export function GridView({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  tagFilter,
  setTagFilter,
  selectedItemIds,
  onBackgroundClick,
  onDragStart,
  onItemOpen,
  onEditItem,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  tagFilter: GridTagFilter;
  setTagFilter: React.Dispatch<React.SetStateAction<GridTagFilter>>;
  selectedItemIds: string[];
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
  onEditItem: (itemId: string) => void;
  onAddTag: (itemId: string, tagText: string) => void;
  onRemoveTag: (itemId: string, tagText: string) => void;
  onDeleteItem: (itemId: string) => void;
}) {
  const filteredItems = useMemo(
    () =>
      tagFilter === "all"
        ? items
        : items.filter((item) => item.tagIds.includes(tagFilter)),
    [items, tagFilter],
  );
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  return (
    <section
      className="view-scroller grid-view"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onBackgroundClick();
      }}
    >
      <div className="filter-bar">
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

      {filteredItems.length ? (
        <div
          className="item-grid"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) onBackgroundClick();
          }}
        >
          {filteredItems.map((item) => (
            <ItemCard
              item={item}
              tags={tags}
              canvasColors={canvasColorsForItem(item.id, canvases)}
              key={item.id}
              thumbUrls={thumbUrls}
              setThumbUrls={setThumbUrls}
              isSelected={selectedSet.has(item.id)}
              selectedItemIds={selectedItemIds}
              onDragStart={onDragStart}
              onOpen={(itemId, event) =>
                onItemOpen(itemId, event, filteredItems, true)
              }
              onEdit={onEditItem}
              onAddTag={onAddTag}
              onRemoveTag={onRemoveTag}
              onDelete={onDeleteItem}
            />
          ))}
        </div>
      ) : (
        <EmptyState label="No items in this view" />
      )}
    </section>
  );
}
