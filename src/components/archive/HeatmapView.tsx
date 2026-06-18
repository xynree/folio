import React, { useCallback, useMemo, useRef } from "react";
import type { FolioItem } from "../../types";
import { addDays } from "../folio/dates";
import {
  dateFromKey,
  dateKeyFromDate,
  dateKeyFromItem,
  formatCount,
  formatDateLabel,
} from "../folio/model";

const HEATMAP_WEEKS = 53;
const HEATMAP_DAYS_PER_WEEK = 7;
const HEATMAP_MAX_COUNT = 8;
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function latestHeatmapDate(items: FolioItem[]) {
  const todayKey = dateKeyFromDate(new Date());
  const latestItemKey = items
    .map(dateKeyFromItem)
    .reduce((latest, key) => (key > latest ? key : latest), todayKey);
  const latest = dateFromKey(latestItemKey);
  return addDays(latest, HEATMAP_DAYS_PER_WEEK - 1 - latest.getDay());
}

export function ArchiveHeatmap({
  items,
  ariaLabel = "Upload heatmap",
  minimized = false,
  unitLabel = "upload",
}: {
  items: FolioItem[];
  ariaLabel?: string;
  minimized?: boolean;
  unitLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const countsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      const dateKey = dateKeyFromItem(item);
      counts.set(dateKey, (counts.get(dateKey) ?? 0) + 1);
    });
    return counts;
  }, [items]);

  const weeks = useMemo(() => {
    const endDate = latestHeatmapDate(items);
    const startDate = addDays(
      endDate,
      -(HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK - 1),
    );

    return Array.from({ length: HEATMAP_WEEKS }, (_, weekIndex) =>
      Array.from({ length: HEATMAP_DAYS_PER_WEEK }, (_, dayIndex) => {
        const date = addDays(
          startDate,
          weekIndex * HEATMAP_DAYS_PER_WEEK + dayIndex,
        );
        const dateKey = dateKeyFromDate(date);
        const count = countsByDate.get(dateKey) ?? 0;
        const level = Math.min(count, HEATMAP_MAX_COUNT);
        return {
          count,
          date,
          dateKey,
          level,
        };
      }),
    );
  }, [countsByDate, items]);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const scroller = scrollRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth) return;

    const horizontalDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
        ? event.deltaX
        : event.deltaY;
    if (!horizontalDelta) return;

    event.preventDefault();
    scroller.scrollLeft += horizontalDelta;
  }, []);

  return (
    <div
      className="archive-heatmap"
      aria-hidden={minimized}
      aria-label={minimized ? undefined : ariaLabel}
    >
      <div className="archive-heatmap-content">
        <div
          className="archive-heatmap-scroll"
          ref={scrollRef}
          onWheel={handleWheel}
        >
          <div className="archive-heatmap-months" aria-hidden="true">
            {weeks.map((week, index) => {
              const firstDay = week[0].date;
              const showLabel = index === 0 || firstDay.getDate() <= 7;
              return (
                <span key={week[0].dateKey}>
                  {showLabel ? MONTH_LABELS[firstDay.getMonth()] : ""}
                </span>
              );
            })}
          </div>
          <div className="archive-heatmap-grid" role="grid" aria-label="Uploads by day">
            {weeks.map((week) => (
              <div className="archive-heatmap-week" role="row" key={week[0].dateKey}>
                {week.map((day) => (
                  <span
                    aria-label={`${formatDateLabel(day.dateKey)}: ${formatCount(
                      day.count,
                      unitLabel,
                    )}`}
                    className={`heatmap-cell heatmap-level-${day.level}`}
                    data-count={day.count}
                    data-date={day.dateKey}
                    data-level={day.level}
                    key={day.dateKey}
                    role="gridcell"
                    title={`${formatDateLabel(day.dateKey)} · ${formatCount(
                      day.count,
                      unitLabel,
                    )}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="archive-heatmap-legend" aria-hidden="true">
          <span>Less</span>
          {Array.from({ length: HEATMAP_MAX_COUNT + 1 }, (_, level) => (
            <span
              className={`heatmap-cell heatmap-level-${level}`}
              key={level}
            />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
