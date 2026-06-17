import React, { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Save, Star, Trash2, X } from "lucide-react";
import type { Canvas, FolioItem, ItemStage, ThumbnailUrls, Tag } from "../../types";
import { ITEM_STAGE_LABELS, TYPE_LABELS } from "../folio/constants";
import type { ItemDetailsMode } from "../folio/types";
import { basename, tagTextsForItem } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";

export function DetailDrawer({
  item,
  tags,
  canvases,
  thumbUrls,
  setThumbUrls,
  initialFocus,
  onClose,
  onPatch,
  onAddTag,
  onRemoveTag,
  onAddToCanvas,
  onPromoteToOutput,
  onDelete,
}: {
  item: FolioItem | null;
  tags: Tag[];
  canvases: Canvas[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  initialFocus: ItemDetailsMode;
  onClose: () => void;
  onPatch: (itemId: string, patch: Partial<FolioItem>, message?: string) => void;
  onAddTag: (itemId: string, text: string) => void;
  onRemoveTag: (itemId: string, tagText: string) => void;
  onAddToCanvas: (itemId: string) => void;
  onPromoteToOutput: (itemId: string) => void;
  onDelete: (itemId: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [stage, setStage] = useState<"" | ItemStage>("");
  const [tagInput, setTagInput] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const tagInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setTitle(item?.title ?? "");
    setDescription(item?.description ?? "");
    setStage(item?.stage ?? "");
    setTagInput("");
  }, [item]);

  useEffect(() => {
    if (!item) return undefined;
    const timeout = window.setTimeout(() => {
      if (initialFocus === "tags") {
        tagInputRef.current?.focus();
      } else {
        titleInputRef.current?.focus();
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialFocus, item]);

  const normalizedTitle = item ? title.trim() || basename(item.path) : title.trim();
  const hasUnsavedChanges = !!item
    && (normalizedTitle !== item.title ||
      description !== item.description ||
      stage !== (item.stage ?? ""));

  const saveDetails = useCallback(() => {
    if (!item) return;

    const patch: Partial<FolioItem> = {};
    const nextTitle = title.trim() || basename(item.path);
    if (nextTitle !== item.title) patch.title = nextTitle;
    if (description !== item.description) patch.description = description;
    if (stage !== (item.stage ?? "")) patch.stage = stage || undefined;

    if (Object.keys(patch).length) {
      onPatch(item.id, patch, "Details saved");
    }
  }, [description, item, onPatch, stage, title]);

  const submitTag = () => {
    if (!item) return;
    if (!tagInput.trim()) return;
    onAddTag(item.id, tagInput);
    setTagInput("");
  };

  if (!item) return null;

  const itemTags = tagTextsForItem(item, tags);
  const itemCanvases = canvases.filter((canvas) => canvas.itemIds.includes(item.id));

  return (
    <div
      className="detail-modal-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside
        className="detail-drawer detail-modal"
        aria-label="Item details"
        aria-modal="true"
        role="dialog"
      >
        <div className="drawer-header">
          <div className="drawer-title">
            <p>{TYPE_LABELS[item.type]}</p>
            <strong>{basename(item.path)}</strong>
          </div>
          <div
            className="drawer-header-actions"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              className="drawer-save-button"
              type="button"
              disabled={!hasUnsavedChanges}
              onClick={saveDetails}
            >
              <ButtonIcon icon={Save} />
              Save
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              aria-label="Close details"
              title="Close details"
            >
              <ButtonIcon icon={X} />
            </button>
          </div>
        </div>

        <div className="drawer-preview">
          <LazyThumbnail
            item={item}
            thumbUrls={thumbUrls}
            setThumbUrls={setThumbUrls}
          />
        </div>

        <label className="field">
          <span>Title</span>
          <input
            ref={titleInputRef}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveDetails();
              }
            }}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={description}
            rows={4}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                saveDetails();
              }
            }}
          />
        </label>

        <label className="field">
          <span>Stage</span>
          <select
            value={stage}
            onChange={(event) => setStage(event.currentTarget.value as "" | ItemStage)}
          >
            <option value="">No stage</option>
            {Object.entries(ITEM_STAGE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <div className="drawer-section">
          <div className="drawer-label">Tags</div>
          <div className="tag-list">
            {itemTags.length ? (
              itemTags.map((tag) => (
                <button
                  className="tag-chip tag-chip-removable"
                  key={tag}
                  type="button"
                  onClick={() => onRemoveTag(item.id, tag)}
                >
                  {tag}
                  <ButtonIcon icon={X} size={12} />
                </button>
              ))
            ) : (
              <span className="muted">No tags</span>
            )}
          </div>
          <div className="tag-input-row">
            <input
              ref={tagInputRef}
              className="tag-input"
              placeholder="Tag name"
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitTag();
                }
              }}
            />
            <button type="button" onClick={submitTag}>
              <ButtonIcon icon={Plus} />
              Add tag
            </button>
          </div>
        </div>

        <div className="drawer-section">
          <div className="drawer-label">Board membership</div>
          {itemCanvases.length ? (
            <div className="canvas-chip-list">
              {itemCanvases.map((canvas) => (
                <span className="canvas-chip" key={canvas.id}>
                  <span style={{ background: canvas.color }} aria-hidden="true" />
                  {canvas.title}
                </span>
              ))}
            </div>
          ) : (
            <p className="muted">No boards</p>
          )}
        </div>

        <div className="drawer-actions">
          <button type="button" onClick={() => onAddToCanvas(item.id)}>
            <ButtonIcon icon={Plus} />
            Add to board
          </button>
          <button type="button" onClick={() => window.folio.openInFinder(item.path)}>
            <ButtonIcon icon={FolderOpen} />
            Show in Finder
          </button>
          <button type="button" onClick={() => onPromoteToOutput(item.id)}>
            <ButtonIcon icon={Star} />
            Promote to output
          </button>
          <button
            className="danger-action"
            type="button"
            onClick={() => onDelete(item.id)}
          >
            <ButtonIcon icon={Trash2} />
            Delete
          </button>
        </div>
      </aside>
    </div>
  );
}
