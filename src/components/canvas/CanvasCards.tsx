import React, { useEffect, useState } from "react";
import {
  ExternalLink,
  FileText,
  GripVertical,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Trash2,
  X,
} from "lucide-react";
import type {
  CanvasConnectionSide,
  CanvasLink,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasSection,
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

function fileExtension(filePath: string): string {
  const filename = basename(filePath);
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index + 1).toUpperCase() : "FILE";
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
  kind = "item",
  position,
  isMatched = false,
  isSelected = false,
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
  kind?: Extract<CanvasObjectKind, "item" | "document">;
  position: CanvasObjectGeometry;
  isMatched?: boolean;
  isSelected?: boolean;
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
  if (kind === "document") {
    return (
      <div
        className={`canvas-document-card ${
          isSelected ? "canvas-object-selected" : ""
        } ${isMatched ? "canvas-object-search-match" : ""}`}
        data-canvas-object-id={item.id}
        data-canvas-object-kind="document"
        style={objectCardStyle("document", position)}
        onPointerDown={onPointerDown}
        onClickCapture={onClickCapture}
        onClick={() => onOpen(item.id)}
        onDoubleClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onOpen(item.id);
        }}
      >
        <div className="canvas-document-icon">
          <ButtonIcon icon={FileText} />
        </div>
        <div className="canvas-document-copy">
          <strong>{label}</strong>
          <span>{fileExtension(item.path)}</span>
        </div>
        <button
          className="icon-button canvas-card-remove-button"
          type="button"
          aria-label={`Remove ${label} from board`}
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

  return (
    <div
      className={`canvas-card ${isSelected ? "canvas-object-selected" : ""} ${
        isMatched ? "canvas-object-search-match" : ""
      }`}
      data-canvas-object-id={item.id}
      data-canvas-object-kind="item"
      style={objectCardStyle("item", position)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onClick={() => onOpen(item.id)}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen(item.id);
      }}
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

export function CanvasLinkCard({
  link,
  isMatched = false,
  isSelected = false,
  onChange,
  onDelete,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  link: CanvasLink;
  isMatched?: boolean;
  isSelected?: boolean;
  onChange: (
    linkId: string,
    patch: Partial<Pick<CanvasLink, "title" | "description" | "url">>,
  ) => void;
  onDelete: (linkId: string) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(link.title);
  const [descriptionDraft, setDescriptionDraft] = useState(link.description ?? "");

  useEffect(() => {
    setTitleDraft(link.title);
    setDescriptionDraft(link.description ?? "");
  }, [link.description, link.title]);

  const saveDrafts = () => {
    const nextTitle = titleDraft.trim() || link.url;
    const nextDescription = descriptionDraft.trim() || undefined;
    if (nextTitle === link.title && nextDescription === link.description) return;
    onChange(link.id, {
      title: nextTitle,
      description: nextDescription,
    });
  };

  return (
    <article
      className={`canvas-link-card ${
        isSelected ? "canvas-object-selected" : ""
      } ${isMatched ? "canvas-object-search-match" : ""}`}
      data-canvas-object-id={link.id}
      data-canvas-object-kind="link"
      style={objectCardStyle("link", link)}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <div className="canvas-link-header">
        <span>
          <ButtonIcon icon={LinkIcon} size={14} />
          {link.sourceDomain || "Link"}
        </span>
        <button
          className="icon-button"
          type="button"
          aria-label="Delete link"
          title="Delete link"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(link.id);
          }}
        >
          <ButtonIcon icon={Trash2} />
        </button>
      </div>
      <input
        aria-label="Link title"
        value={titleDraft}
        onBlur={saveDrafts}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setTitleDraft(event.currentTarget.value)}
      />
      <textarea
        aria-label="Link description"
        placeholder="Description"
        value={descriptionDraft}
        onBlur={saveDrafts}
        onPointerDown={(event) => event.stopPropagation()}
        onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
      />
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <ButtonIcon icon={ExternalLink} size={13} />
        Open
      </a>
      <ResizeCorner label={link.title} onPointerDown={onResizePointerDown} />
      <ConnectionHandles
        label={link.title}
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </article>
  );
}

export function CanvasSectionFrame({
  section,
  isMatched = false,
  isSelected = false,
  onChange,
  onDelete,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  section: CanvasSection;
  isMatched?: boolean;
  isSelected?: boolean;
  onChange: (
    sectionId: string,
    patch: Partial<Pick<CanvasSection, "title" | "color" | "collapsed">>,
  ) => void;
  onDelete: (sectionId: string) => void;
  onConnectorPointerDown: ConnectorPointerDownHandler;
  onPointerDown: (event: React.PointerEvent) => void;
  onResizePointerDown: ResizePointerDownHandler;
  onClickCapture: (event: React.MouseEvent) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(section.title);

  useEffect(() => {
    setTitleDraft(section.title);
  }, [section.title]);

  const saveTitle = () => {
    const nextTitle = titleDraft.trim() || "Section";
    if (nextTitle === section.title) return;
    onChange(section.id, { title: nextTitle });
  };

  return (
    <section
      className={`canvas-section-frame ${
        section.collapsed ? "canvas-section-collapsed" : ""
      } ${isSelected ? "canvas-object-selected" : ""} ${
        isMatched ? "canvas-object-search-match" : ""
      }`}
      data-canvas-object-id={section.id}
      data-canvas-object-kind="section"
      style={{
        ...objectCardStyle("section", section),
        "--section-color": section.color ?? "#9f6b3d",
      } as React.CSSProperties}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
    >
      <div className="canvas-section-header">
        <input
          aria-label="Section title"
          value={titleDraft}
          onBlur={saveTitle}
          onPointerDown={(event) => event.stopPropagation()}
          onChange={(event) => setTitleDraft(event.currentTarget.value)}
        />
        <button
          className="icon-button"
          type="button"
          aria-label={section.collapsed ? "Expand section" : "Collapse section"}
          title={section.collapsed ? "Expand section" : "Collapse section"}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onChange(section.id, { collapsed: !section.collapsed });
          }}
        >
          <ButtonIcon icon={section.collapsed ? Maximize2 : Minimize2} />
        </button>
        <button
          className="icon-button"
          type="button"
          aria-label="Delete section"
          title="Delete section"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete(section.id);
          }}
        >
          <ButtonIcon icon={Trash2} />
        </button>
      </div>
      <ResizeCorner label={section.title} onPointerDown={onResizePointerDown} />
      <ConnectionHandles
        label={section.title}
        onConnectorPointerDown={onConnectorPointerDown}
      />
    </section>
  );
}

export function CanvasNoteCard({
  note,
  isMatched = false,
  isSelected = false,
  onChange,
  onDelete,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  note: CanvasNote;
  isMatched?: boolean;
  isSelected?: boolean;
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
      className={`canvas-note ${isSelected ? "canvas-object-selected" : ""} ${
        isMatched ? "canvas-object-search-match" : ""
      }`}
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
  isMatched = false,
  isSelected = false,
  onChange,
  onDelete,
  onSizeChange,
  onConnectorPointerDown,
  onPointerDown,
  onResizePointerDown,
  onClickCapture,
}: {
  textElement: CanvasTextElement;
  isMatched?: boolean;
  isSelected?: boolean;
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
      className={`canvas-text-card canvas-text-size-${textSize} ${
        isSelected ? "canvas-object-selected" : ""
      } ${isMatched ? "canvas-object-search-match" : ""}`}
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
