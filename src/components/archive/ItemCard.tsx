import type React from "react";
import type { FolioItem, Tag, ThumbnailUrls } from "../../types";
import { basename, tagTextsForItem } from "../folio/model";
import { CanvasDots } from "../shared/CanvasDots";
import { LazyThumbnail } from "../shared/LazyThumbnail";

export function ItemCard({
  item,
  tags,
  canvasColors,
  thumbUrls,
  setThumbUrls,
  isSelected,
  isWork = false,
  onDragStart,
  onOpen,
  onEdit,
  compact = false,
}: {
  item: FolioItem;
  tags: Tag[];
  canvasColors: string[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  isSelected: boolean;
  isWork?: boolean;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onOpen: (itemId: string, event: React.MouseEvent) => void;
  onEdit: (itemId: string) => void;
  compact?: boolean;
}) {
  const itemTags = tagTextsForItem(item, tags);

  return (
    <article
      className={`item-card ${compact ? "item-card-compact" : ""} ${
        item.missing ? "item-missing" : ""
      } ${isSelected ? "item-selected" : ""} ${isWork ? "item-work" : ""}`}
      draggable={!item.missing}
      title={item.path}
      onDragStart={(event) => onDragStart(item.id, event)}
    >
      <button
        className="item-card-main"
        type="button"
        onClick={(event) => onOpen(item.id, event)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEdit(item.id);
        }}
      >
        <LazyThumbnail
          item={item}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
        />
        <CanvasDots colors={canvasColors} />
        {isWork ? (
          <span className="item-work-badge" title="Marked as Work">
            Work
          </span>
        ) : null}
        <span className="item-title">{item.title || basename(item.path)}</span>
        {itemTags.length ? (
          <span className="card-tags">
            {itemTags.slice(0, compact ? 2 : 3).map((tag) => (
              <span className="tag-chip" key={tag}>
                {tag}
              </span>
            ))}
          </span>
        ) : null}
      </button>
    </article>
  );
}
