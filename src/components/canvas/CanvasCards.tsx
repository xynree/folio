import React, { useEffect, useState } from "react";
import { GripVertical, Trash2, X } from "lucide-react";
import type {
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import { basename } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";

export function CanvasItemCard({
  item,
  position,
  thumbUrls,
  setThumbUrls,
  onOpen,
  onRemove,
  onPointerDown,
  onClickCapture,
}: {
  item: FolioItem;
  position: CanvasPosition;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpen: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      className="canvas-card"
      data-canvas-object-id={item.id}
      data-canvas-object-kind="item"
      style={{
        transform: `translate(${position.x + CANVAS_WORLD_ORIGIN}px, ${
          position.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onClick={() => onOpen(item.id)}
    >
      <div className="canvas-card-media">
        <LazyThumbnail
          item={item}
          thumbUrls={thumbUrls}
          setThumbUrls={setThumbUrls}
        />
        <button
          className="icon-button canvas-card-remove-button"
          type="button"
          aria-label={`Remove ${item.title || basename(item.path)} from board`}
          title="Remove from board"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(item.id);
          }}
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <strong>{item.title || basename(item.path)}</strong>
    </div>
  );
}

export function ReferenceCard({
  reference,
  position,
  onRemove,
  onPointerDown,
  onClickCapture,
}: {
  reference: CanvasReference;
  position: CanvasPosition;
  onRemove: (referenceId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    window.folio
      .ensureReferenceThumbnail(reference.id, reference.path)
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [reference.path]);

  return (
    <div
      className="canvas-card reference-card"
      data-canvas-object-id={reference.id}
      data-canvas-object-kind="reference"
      style={{
        transform: `translate(${position.x + CANVAS_WORLD_ORIGIN}px, ${
          position.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <div className="canvas-card-handle">
        <span>Reference</span>
        <button
          className="icon-button"
          type="button"
          aria-label={`Remove ${reference.filename}`}
          title="Remove reference"
          onClick={(event) => {
            event.stopPropagation();
            onRemove(reference.id);
          }}
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <span className="thumb-shell">
        {src ? (
          <img loading="lazy" src={src} alt="" draggable={false} />
        ) : (
          <span className="thumb-placeholder">Ref</span>
        )}
      </span>
      <strong>{reference.filename}</strong>
    </div>
  );
}

export function CanvasNoteCard({
  note,
  onChange,
  onDelete,
  onPointerDown,
  onClickCapture,
}: {
  note: CanvasNote;
  onChange: (noteId: string, text: string) => void;
  onDelete: (noteId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const [draft, setDraft] = useState(note.text);

  useEffect(() => {
    setDraft(note.text);
  }, [note.text]);

  return (
    <div
      className="canvas-note"
      data-canvas-object-id={note.id}
      data-canvas-object-kind="note"
      style={{
        transform: `translate(${note.x + CANVAS_WORLD_ORIGIN}px, ${
          note.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <div className="canvas-note-handle">
        <span>
          <ButtonIcon icon={GripVertical} size={14} />
          Note
        </span>
        <button
          className="icon-button"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(note.id);
          }}
          aria-label="Delete note"
          title="Delete note"
        >
          <ButtonIcon icon={Trash2} />
        </button>
      </div>
      <textarea
        placeholder="Note"
        value={draft}
        onBlur={() => {
          if (draft.trim()) {
            onChange(note.id, draft);
          } else {
            onDelete(note.id);
          }
        }}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  );
}
