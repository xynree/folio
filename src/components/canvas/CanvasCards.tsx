import React, { useEffect, useState } from "react";
import { GripVertical, Trash2, X } from "lucide-react";
import type {
  CanvasConnectionSide,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasReference,
  CanvasTextElement,
  CanvasTextSize,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import { CANVAS_WORLD_ORIGIN } from "../folio/constants";
import { basename } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import { sizeForCanvasObject } from "./canvasGeometry";
import type { CanvasObjectKind } from "./canvasTypes";

type ConnectorPointerDownHandler = (
  event: React.PointerEvent<HTMLButtonElement>,
  side: CanvasConnectionSide,
) => void;

type ResizePointerDownHandler = (
  event: React.PointerEvent<HTMLElement>,
) => void;

const CONNECTOR_SIDES: CanvasConnectionSide[] = ["top", "right", "bottom", "left"];
const TEXT_SAVE_DEBOUNCE_MS = 500;
const TEXT_SIZE_OPTIONS: Array<{ label: string; size: CanvasTextSize }> = [
  { label: "Sm", size: "sm" },
  { label: "Md", size: "md" },
  { label: "Large", size: "large" },
];

function objectCardStyle(
  kind: CanvasObjectKind,
  geometry: CanvasObjectGeometry,
): React.CSSProperties {
  const size = sizeForCanvasObject(kind, geometry);
  return {
    height: size.height,
    transform: `translate(${geometry.x + CANVAS_WORLD_ORIGIN}px, ${
      geometry.y + CANVAS_WORLD_ORIGIN
    }px)`,
    width: size.width,
  };
}

function ConnectionHandles({
  label,
  onConnectorPointerDown,
}: {
  label: string;
  onConnectorPointerDown: ConnectorPointerDownHandler;
}) {
  return (
    <span className="canvas-connector-nodes" aria-hidden={false}>
      {CONNECTOR_SIDES.map((side) => (
        <button
          aria-label={`Connect ${label} from ${side}`}
          className={`canvas-connector-node canvas-connector-node-${side}`}
          data-connector-side={side}
          key={side}
          type="button"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => onConnectorPointerDown(event, side)}
        />
      ))}
    </span>
  );
}

function ResizeCorner({
  label,
  onPointerDown,
}: {
  label: string;
  onPointerDown: ResizePointerDownHandler;
}) {
  return (
    <span
      className="canvas-card-resize-corner"
      title={`Resize ${label}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={onPointerDown}
    />
  );
}

export function CanvasItemCard({
  item,
  position,
  thumbUrls,
  setThumbUrls,
  onOpen,
  onRemove,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  item: FolioItem;
  position: CanvasObjectGeometry;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onOpen: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const label = item.title || basename(item.path);
  return (
    <div
      className="canvas-card"
      data-canvas-object-id={item.id}
      data-canvas-object-kind="item"
      style={objectCardStyle("item", position)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onClick={() => onOpen(item.id)}
    >
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
      <ResizeCorner label={label} onPointerDown={onResizePointerDown} />
      <ConnectionHandles
        label={label}
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </div>
  );
}

export function ReferenceCard({
  reference,
  position,
  onRemove,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  reference: CanvasReference;
  position: CanvasObjectGeometry;
  onRemove: (referenceId: string) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
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
  }, [reference.id, reference.path]);

  return (
    <div
      className="canvas-card reference-card"
      data-canvas-object-id={reference.id}
      data-canvas-object-kind="reference"
      style={objectCardStyle("reference", position)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <span className="thumb-shell">
        {src ? (
          <img loading="lazy" src={src} alt="" draggable={false} />
        ) : (
          <span className="thumb-placeholder">Ref</span>
        )}
      </span>
      <button
        className="icon-button canvas-card-remove-button"
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
      <ResizeCorner
        label={reference.filename}
        onPointerDown={onResizePointerDown}
      />
      <ConnectionHandles
        label={reference.filename}
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </div>
  );
}

export function CanvasNoteCard({
  note,
  onChange,
  onDelete,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  note: CanvasNote;
  onChange: (noteId: string, text: string) => void;
  onDelete: (noteId: string) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
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
      style={objectCardStyle("note", note)}
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
      <ResizeCorner label="note" onPointerDown={onResizePointerDown} />
      <ConnectionHandles
        label="note"
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </div>
  );
}

export function CanvasTextCard({
  textElement,
  onChange,
  onDelete,
  onSizeChange,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  textElement: CanvasTextElement;
  onChange: (textElementId: string, text: string) => void;
  onDelete: (textElementId: string) => void;
  onSizeChange: (textElementId: string, size: CanvasTextSize) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const [draft, setDraft] = useState(textElement.text);
  const textSize = textElement.size ?? "md";

  useEffect(() => {
    setDraft(textElement.text);
  }, [textElement.text]);

  useEffect(() => {
    if (draft === textElement.text) return undefined;

    const timeout = window.setTimeout(() => {
      onChange(textElement.id, draft);
    }, TEXT_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [draft, onChange, textElement.id, textElement.text]);

  return (
    <div
      className={`canvas-text-card canvas-text-size-${textSize}`}
      data-canvas-object-id={textElement.id}
      data-canvas-object-kind="text"
      style={objectCardStyle("text", textElement)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <button
        className="icon-button canvas-text-delete-button"
        type="button"
        aria-label="Delete text"
        title="Delete text"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(textElement.id);
        }}
      >
        <ButtonIcon icon={Trash2} />
      </button>
      <div className="canvas-text-size-control" aria-label="Text size">
        {TEXT_SIZE_OPTIONS.map((option) => (
          <button
            className={
              option.size === textSize ? "canvas-text-size-active" : ""
            }
            key={option.size}
            type="button"
            aria-label={`${option.label} text`}
            aria-pressed={option.size === textSize}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onSizeChange(textElement.id, option.size);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
      <textarea
        aria-label="Board text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <ResizeCorner label="text" onPointerDown={onResizePointerDown} />
      <ConnectionHandles
        label="text"
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </div>
  );
}
