import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import type { ItemOpenHandler } from "../folio/types";
import {
  buildDateRange,
  canvasColorsForItem,
  formatCount,
  formatDateLabel,
  groupItemsByDate,
} from "../folio/model";
import { EmptyState } from "../shared/EmptyState";
import { ItemCard } from "./ItemCard";

export function DailyStripView({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  selectedItemIds,
  showDateGaps,
  onBackgroundClick,
  onDragStart,
  onItemOpen,
  onEditItem,
  onAddTag,
  onRemoveTag,
  onDeleteItem,
  onPromoteToOutput,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  selectedItemIds: string[];
  showDateGaps: boolean;
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
  onEditItem: (itemId: string) => void;
  onAddTag: (itemId: string, tagText: string) => void;
  onRemoveTag: (itemId: string, tagText: string) => void;
  onDeleteItem: (itemId: string) => void;
  onPromoteToOutput: (itemId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const groups = useMemo(() => groupItemsByDate(items), [items]);
  const dates = useMemo(
    () =>
      showDateGaps
        ? buildDateRange(items)
        : Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)),
    [groups, items, showDateGaps],
  );
  const visualOrderedItems = useMemo(
    () => dates.flatMap((date) => groups.get(date) ?? []),
    [dates, groups],
  );
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = Number(sessionStorage.getItem("folio:strip-scroll") ?? 0);
  }, []);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    sessionStorage.setItem(
      "folio:strip-scroll",
      String(event.currentTarget.scrollTop),
    );
  }, []);

  return (
    <section
      className="view-scroller strip-view"
      ref={scrollerRef}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onBackgroundClick();
      }}
      onScroll={handleScroll}
    >
      {items.length ? null : <EmptyState label="No archive items yet" />}
      {dates.map((date) => {
        const dayItems = groups.get(date) ?? [];
        return (
          <article
            className={`day-row ${dayItems.length ? "" : "day-row-empty"}`}
            key={date}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) onBackgroundClick();
            }}
          >
            <div className="day-meta">
              <strong>{formatDateLabel(date)}</strong>
              {dayItems.length ? (
                <span>{formatCount(dayItems.length, "item")}</span>
              ) : null}
            </div>

            {dayItems.length ? (
              <div
                className="strip-items"
                onMouseDown={(event) => {
                  if (event.currentTarget === event.target) onBackgroundClick();
                }}
              >
                {dayItems.map((item) => (
                  <ItemCard
                    compact
                    item={item}
                    tags={tags}
                    canvasColors={canvasColorsForItem(item.id, canvases)}
                    key={item.id}
                    thumbUrls={thumbUrls}
                    setThumbUrls={setThumbUrls}
                    isSelected={selectedSet.has(item.id)}
                    onDragStart={onDragStart}
                    onOpen={(itemId, event) =>
                      onItemOpen(itemId, event, visualOrderedItems, true)
                    }
                    onEdit={onEditItem}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    onDelete={onDeleteItem}
                    onPromoteToOutput={onPromoteToOutput}
                  />
                ))}
              </div>
            ) : (
              <div className="gap-line" aria-label="No items for this date" />
            )}
          </article>
        );
      })}
    </section>
  );
}
