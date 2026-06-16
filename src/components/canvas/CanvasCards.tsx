import React, { useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import type {
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import { TYPE_LABELS, CANVAS_WORLD_ORIGIN } from "../folio/constants";
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
}: {
  item: FolioItem;
  position: CanvasPosition;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpen: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <div
      className="canvas-card"
      style={{
        transform: `translate(${position.x + CANVAS_WORLD_ORIGIN}px, ${
          position.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
      onClick={() => onOpen(item.id)}
    >
      <div
        className="canvas-card-handle"
        onPointerDown={onPointerDown}
        onClick={(event) => event.stopPropagation()}
      >
        <span>{TYPE_LABELS[item.type]}</span>
        <button
          className="icon-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Remove ${item.title || basename(item.path)} from board`}
          title="Remove from board"
          onClick={() => onRemove(item.id)}
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <LazyThumbnail
        item={item}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
      />
      <strong>{item.title || basename(item.path)}</strong>
    </div>
  );
}

export function ReferenceCard({
  reference,
  position,
  onRemove,
  onPointerDown,
}: {
  reference: CanvasReference;
  position: CanvasPosition;
  onRemove: (referenceId: string) => void;
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    window.folio
      .getFileDataUrl(reference.path)
      .then((dataUrl) => {
        if (!cancelled) setSrc(dataUrl);
      })
      .catch((error) => console.error(error));

    return () => {
      cancelled = true;
    };
  }, [reference.path]);

  return (
    <div
      className="canvas-card reference-card"
      style={{
        transform: `translate(${position.x + CANVAS_WORLD_ORIGIN}px, ${
          position.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
    >
      <div className="canvas-card-handle" onPointerDown={onPointerDown}>
        <span>Reference</span>
        <button
          className="icon-button"
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          aria-label={`Remove ${reference.filename}`}
          title="Remove reference"
          onClick={() => onRemove(reference.id)}
        >
          <ButtonIcon icon={X} />
        </button>
      </div>
      <span className="thumb-shell">
        {src ? <img src={src} alt="" /> : <span className="thumb-placeholder">Ref</span>}
      </span>
      <strong>{reference.filename}</strong>
    </div>
  );
}

export function CanvasNoteCard({
  note,
  onChange,
  onDelete,
}: {
  note: CanvasNote;
  onChange: (noteId: string, text: string) => void;
  onDelete: (noteId: string) => void;
}) {
  const [draft, setDraft] = useState(note.text);

  useEffect(() => {
    setDraft(note.text);
  }, [note.text]);

  return (
    <div
      className="canvas-note"
      style={{
        transform: `translate(${note.x + CANVAS_WORLD_ORIGIN}px, ${
          note.y + CANVAS_WORLD_ORIGIN
        }px)`,
      }}
    >
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
      <button
        type="button"
        onClick={() => onDelete(note.id)}
        aria-label="Delete note"
      >
        <ButtonIcon icon={Trash2} />
        Delete
      </button>
    </div>
  );
}
