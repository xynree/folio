import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  PanelLeftClose,
  PanelLeftOpen,
  Tag as TagIcon,
} from "lucide-react";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import type { GridTagFilter, ItemDetailsOpenHandler } from "../folio/types";
import { canvasColorsForItem, formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { CanvasDots } from "../shared/CanvasDots";
import { LazyThumbnail } from "../shared/LazyThumbnail";

export function TagsSidebar({
  items,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  onOpenItem,
  collapsed,
  onToggleCollapsed,
  tagFilter,
  setTagFilter,
}: {
  items: FolioItem[];
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpenItem: ItemDetailsOpenHandler;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  tagFilter: GridTagFilter;
  setTagFilter: React.Dispatch<React.SetStateAction<GridTagFilter>>;
}) {
  const [expandedTagIds, setExpandedTagIds] = useState<string[]>([]);

  const itemCounts = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => {
      item.tagIds.forEach((tagId) => {
        counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
      });
    });
    return counts;
  }, [items]);

  const toggleExpanded = (tagId: string) => {
    setExpandedTagIds((current) =>
      current.includes(tagId)
        ? current.filter((expandedId) => expandedId !== tagId)
        : [...current, tagId],
    );
  };

  if (collapsed) {
    return (
      <aside className="tags-sidebar tags-sidebar-collapsed" aria-label="Tags">
        <button
          className="tags-collapse-toggle collapsed"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Show tags"
          title="Show tags"
        >
          <ButtonIcon icon={PanelLeftOpen} />
          <span>Tags</span>
          <small>{tags.length}</small>
        </button>
      </aside>
    );
  }

  return (
    <aside className="tags-sidebar" aria-label="Tags">
      <div className="sidebar-heading">
        <div>
          <strong>Tags</strong>
          <span>{formatCount(tags.length, "tag")}</span>
        </div>
        <button
          className="tags-collapse-toggle"
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Hide tags"
          title="Hide tags"
        >
          <ButtonIcon icon={PanelLeftClose} />
        </button>
      </div>

      <button
        className={`tag-sidebar-row ${tagFilter === "all" ? "active" : ""}`}
        type="button"
        onClick={() => setTagFilter("all")}
      >
        <ButtonIcon icon={TagIcon} />
        <span>All</span>
        <small>{items.length}</small>
      </button>

      {tags.length ? (
        tags.map((tag) => {
          const tagItems = items.filter((item) => item.tagIds.includes(tag.id));
          const expanded = expandedTagIds.includes(tag.id);
          return (
            <article className="tag-sidebar-item" key={tag.id}>
              <div className="tag-sidebar-controls">
                <button
                  className={`tag-sidebar-row ${
                    tag.id === tagFilter ? "active" : ""
                  }`}
                  type="button"
                  onClick={() => setTagFilter(tag.id)}
                >
                  <ButtonIcon icon={TagIcon} />
                  <span>{tag.text}</span>
                  <small>{itemCounts.get(tag.id) ?? 0}</small>
                </button>
                <button
                  className="tag-expand-button"
                  type="button"
                  onClick={() => toggleExpanded(tag.id)}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${tag.text}`}
                  title={`${expanded ? "Collapse" : "Expand"} ${tag.text}`}
                >
                  <ButtonIcon icon={expanded ? ChevronUp : ChevronDown} />
                </button>
              </div>

              {expanded ? (
                <div className="tag-thumbnail-strip">
                  {tagItems.length ? (
                    tagItems.slice(0, 8).map((item) => (
                      <button
                        className="mini-thumb mini-thumb-button"
                        key={item.id}
                        title={item.title}
                        type="button"
                        onClick={() => onOpenItem(item.id)}
                      >
                        <LazyThumbnail
                          item={item}
                          thumbUrls={thumbUrls}
                          setThumbUrls={setThumbUrls}
                        />
                        <CanvasDots colors={canvasColorsForItem(item.id, canvases)} />
                      </button>
                    ))
                  ) : (
                    <span className="muted">No items</span>
                  )}
                </div>
              ) : null}
            </article>
          );
        })
      ) : (
        <p className="sidebar-empty">No user tags yet</p>
      )}
    </aside>
  );
}
