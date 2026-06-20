import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import type { ItemOpenHandler } from "../folio/types";
import {
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
  selectedItemIds: string[];
  workItemIds?: string[];
  onBackgroundClick: () => void;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onItemOpen: ItemOpenHandler;
  onEditItem: (itemId: string) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const groups = useMemo(() => groupItemsByDate(items), [items]);
  const dates = useMemo(
    () => Array.from(groups.keys()).sort((a, b) => b.localeCompare(a)),
    [groups],
  );
  const visualOrderedItems = useMemo(
    () => dates.flatMap((date) => groups.get(date) ?? []),
    [dates, groups],
  );
  const selectedSet = useMemo(() => new Set(selectedItemIds), [selectedItemIds]);
  const workItemSet = useMemo(() => new Set(workItemIds), [workItemIds]);

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
            className="day-row"
            key={date}
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) onBackgroundClick();
            }}
          >
            <div className="day-meta">
              <strong>{formatDateLabel(date)}</strong>
              <span>{formatCount(dayItems.length, "item")}</span>
            </div>

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
                  isWork={workItemSet.has(item.id)}
                  onDragStart={onDragStart}
                  onOpen={(itemId, event) =>
                    onItemOpen(itemId, event, visualOrderedItems, true)
                  }
                  onEdit={onEditItem}
                />
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
