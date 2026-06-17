import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Edit3,
  Ellipsis,
  Tag as TagIcon,
  Trash2,
} from "lucide-react";
import type { FolioItem, Tag, ThumbnailUrls } from "../../types";
import { basename, tagTextsForItem } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { CanvasDots } from "../shared/CanvasDots";
import { LazyThumbnail } from "../shared/LazyThumbnail";

export function ItemCard({
  item,
  tags,
  canvasColors,
  thumbUrls,
  setThumbUrls,
  isSelected,
  onDragStart,
  onOpen,
  onEdit,
  onAddTag,
  onRemoveTag,
  onDelete,
  compact = false,
}: {
  item: FolioItem;
  tags: Tag[];
  canvasColors: string[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  isSelected: boolean;
  onDragStart: (itemId: string, event: React.DragEvent<HTMLElement>) => void;
  onOpen: (itemId: string, event: React.MouseEvent) => void;
  onEdit: (itemId: string) => void;
  onAddTag: (itemId: string, tagText: string) => void;
  onRemoveTag: (itemId: string, tagText: string) => void;
  onDelete: (itemId: string) => void;
  compact?: boolean;
}) {
  const itemTags = tagTextsForItem(item, tags);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tagsMenuOpen, setTagsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const assignedTagIds = useMemo(() => new Set(item.tagIds), [item.tagIds]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
      setTagsMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [menuOpen]);

  return (
    <article
      className={`item-card ${compact ? "item-card-compact" : ""} ${
        item.missing ? "item-missing" : ""
      } ${isSelected ? "item-selected" : ""}`}
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
      <div
        className={`item-more ${menuOpen ? "item-more-open" : ""}`}
        ref={menuRef}
      >
        <button
          className="item-more-button icon-button"
          type="button"
          aria-label={`More actions for ${item.title || basename(item.path)}`}
          aria-expanded={menuOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMenuOpen((current) => {
              if (current) setTagsMenuOpen(false);
              return !current;
            });
          }}
        >
          <ButtonIcon icon={Ellipsis} />
        </button>
        {menuOpen ? (
          <div className="item-more-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              onMouseEnter={() => setTagsMenuOpen(false)}
              onClick={() => {
                setMenuOpen(false);
                onEdit(item.id);
              }}
            >
              <ButtonIcon icon={Edit3} />
              Edit
            </button>
            <div
              className="item-submenu"
              onFocusCapture={() => setTagsMenuOpen(true)}
              onMouseEnter={() => setTagsMenuOpen(true)}
            >
              <button
                className="item-submenu-toggle"
                type="button"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={tagsMenuOpen}
                onClick={() => {
                  setTagsMenuOpen(true);
                }}
              >
                <ButtonIcon icon={TagIcon} />
                <span>Add tags</span>
                <ButtonIcon icon={ChevronRight} size={14} />
              </button>
              {tagsMenuOpen ? (
                <div
                  className="item-tag-submenu"
                  role="menu"
                  aria-label="Add or remove tags"
                >
                  {tags.length ? (
                    tags.map((tag) => {
                      const selected = assignedTagIds.has(tag.id);
                      return (
                        <button
                          className={`item-tag-option ${
                            selected ? "item-tag-option-selected" : ""
                          }`}
                          key={tag.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={selected}
                          onClick={() => {
                            if (selected) {
                              onRemoveTag(item.id, tag.text);
                            } else {
                              onAddTag(item.id, tag.text);
                            }
                          }}
                        >
                          <span>{tag.text}</span>
                          {selected ? <ButtonIcon icon={Check} size={14} /> : null}
                        </button>
                      );
                    })
                  ) : (
                    <span className="item-tag-empty">No tags yet</span>
                  )}
                </div>
              ) : null}
            </div>
            <button
              className="danger-menu-item"
              type="button"
              role="menuitem"
              onMouseEnter={() => setTagsMenuOpen(false)}
              onClick={() => {
                setMenuOpen(false);
                onDelete(item.id);
              }}
            >
              <ButtonIcon icon={Trash2} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
