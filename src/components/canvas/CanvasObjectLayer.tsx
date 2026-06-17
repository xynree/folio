import React from "react";
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
import type { ItemDetailsOpenHandler } from "../folio/types";
import {
  CanvasItemCard,
  CanvasLinkCard,
  CanvasNoteCard,
  CanvasSectionFrame,
  CanvasTextCard,
} from "./CanvasCards";
import { canvasKindForItem } from "./canvasLayout";
import type { CanvasObjectKind } from "./canvasTypes";

type StartConnectorDragHandler = (
  event: React.PointerEvent<HTMLButtonElement>,
  objectId: string,
  fromSide: CanvasConnectionSide,
) => void;

type StartObjectDragHandler = (
  event: React.PointerEvent,
  kind: CanvasObjectKind,
  objectId: string,
  startPosition: CanvasObjectGeometry,
) => void;

type StartObjectResizeHandler = (
  event: React.PointerEvent,
  kind: CanvasObjectKind,
  objectId: string,
  startGeometry: CanvasObjectGeometry,
) => void;

type SuppressClickAfterDragHandler = (
  event: React.MouseEvent,
  kind: CanvasObjectKind,
  objectId: string,
) => void;

type SelectObjectHandler = (
  event: React.PointerEvent,
  kind: CanvasObjectKind,
  objectId: string,
) => void;

type CanvasObjectLayerProps = {
  activeItems: FolioItem[];
  activeLinks?: CanvasLink[];
  activeNotes: CanvasNote[];
  activeSections?: CanvasSection[];
  activeTexts: CanvasTextElement[];
  matchedObjectKeys?: Set<string>;
  selectedObjectKeys?: Set<string>;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  positionForLink: (link: CanvasLink) => CanvasObjectGeometry;
  positionForItem: (item: FolioItem, index: number) => CanvasObjectGeometry;
  positionForNote: (note: CanvasNote) => CanvasObjectGeometry;
  positionForSection: (section: CanvasSection) => CanvasObjectGeometry;
  positionForText: (textElement: CanvasTextElement) => CanvasObjectGeometry;
  onDeleteLink: (linkId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onDeleteSection: (sectionId: string) => void;
  onDeleteTextElement: (textElementId: string) => void;
  onOpenItem: ItemDetailsOpenHandler;
  onRemoveItem: (itemId: string) => void;
  onSelectObject?: SelectObjectHandler;
  onStartConnectorDrag: StartConnectorDragHandler;
  onStartDrag: StartObjectDragHandler;
  onStartResize: StartObjectResizeHandler;
  onSuppressClickAfterDrag: SuppressClickAfterDragHandler;
  onUpdateLink: (
    linkId: string,
    patch: Partial<Pick<CanvasLink, "title" | "description" | "url">>,
  ) => void;
  onUpdateNote: (noteId: string, text: string) => void;
  onUpdateNoteSize: (noteId: string, size: CanvasTextSize) => void;
  onUpdateSection: (
    sectionId: string,
    patch: Partial<Pick<CanvasSection, "title" | "color" | "collapsed">>,
  ) => void;
  onUpdateTextElement: (textElementId: string, text: string) => void;
  onUpdateTextElementSize: (
    textElementId: string,
    size: CanvasTextSize,
  ) => void;
};

export function CanvasObjectLayer({
  activeItems,
  activeLinks = [],
  activeNotes,
  activeSections = [],
  activeTexts,
  matchedObjectKeys = new Set(),
  selectedObjectKeys = new Set(),
  thumbUrls,
  setThumbUrls,
  positionForLink,
  positionForItem,
  positionForNote,
  positionForSection,
  positionForText,
  onDeleteLink,
  onDeleteNote,
  onDeleteSection,
  onDeleteTextElement,
  onOpenItem,
  onRemoveItem,
  onSelectObject,
  onStartConnectorDrag,
  onStartDrag,
  onStartResize,
  onSuppressClickAfterDrag,
  onUpdateLink,
  onUpdateNote,
  onUpdateNoteSize,
  onUpdateSection,
  onUpdateTextElement,
  onUpdateTextElementSize,
}: CanvasObjectLayerProps) {
  const objectKey = (kind: CanvasObjectKind, objectId: string) =>
    `${kind}:${objectId}`;

  return (
    <>
      {activeSections.map((section) => {
        const position = positionForSection(section);
        return (
          <CanvasSectionFrame
            key={section.id}
            section={{ ...section, ...position }}
            isMatched={matchedObjectKeys.has(objectKey("section", section.id))}
            isSelected={selectedObjectKeys.has(objectKey("section", section.id))}
            onChange={onUpdateSection}
            onDelete={onDeleteSection}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, section.id, side)
            }
            onPointerDown={(event) => {
              onSelectObject?.(event, "section", section.id);
              onStartDrag(event, "section", section.id, position);
            }}
            onResizePointerDown={(event) =>
              onStartResize(event, "section", section.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "section", section.id)
            }
          />
        );
      })}

      {activeItems.map((item, index) => {
        const position = positionForItem(item, index);
        const kind = canvasKindForItem(item);
        return (
          <CanvasItemCard
            item={item}
            kind={kind}
            key={item.id}
            position={position}
            isMatched={matchedObjectKeys.has(objectKey(kind, item.id))}
            isSelected={selectedObjectKeys.has(objectKey(kind, item.id))}
            thumbUrls={thumbUrls}
            setThumbUrls={setThumbUrls}
            onOpen={onOpenItem}
            onRemove={onRemoveItem}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, item.id, side)
            }
            onPointerDown={(event) => {
              onSelectObject?.(event, kind, item.id);
              onStartDrag(event, kind, item.id, position);
            }}
            onResizePointerDown={(event) =>
              onStartResize(event, kind, item.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, kind, item.id)
            }
          />
        );
      })}

      {activeLinks.map((link) => {
        const position = positionForLink(link);
        return (
          <CanvasLinkCard
            key={link.id}
            link={{ ...link, ...position }}
            isMatched={matchedObjectKeys.has(objectKey("link", link.id))}
            isSelected={selectedObjectKeys.has(objectKey("link", link.id))}
            onChange={onUpdateLink}
            onDelete={onDeleteLink}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, link.id, side)
            }
            onPointerDown={(event) => {
              onSelectObject?.(event, "link", link.id);
              onStartDrag(event, "link", link.id, position);
            }}
            onResizePointerDown={(event) =>
              onStartResize(event, "link", link.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "link", link.id)
            }
          />
        );
      })}

      {activeNotes.map((note) => {
        const position = positionForNote(note);
        return (
          <CanvasNoteCard
            key={note.id}
            note={{ ...note, ...position }}
            isMatched={matchedObjectKeys.has(objectKey("note", note.id))}
            isSelected={selectedObjectKeys.has(objectKey("note", note.id))}
            onChange={onUpdateNote}
            onDelete={onDeleteNote}
            onSizeChange={onUpdateNoteSize}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, note.id, side)
            }
            onPointerDown={(event) => {
              onSelectObject?.(event, "note", note.id);
              onStartDrag(event, "note", note.id, position);
            }}
            onResizePointerDown={(event) =>
              onStartResize(event, "note", note.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "note", note.id)
            }
          />
        );
      })}

      {activeTexts.map((textElement) => {
        const position = positionForText(textElement);
        return (
          <CanvasTextCard
            key={textElement.id}
            textElement={{ ...textElement, ...position }}
            isMatched={matchedObjectKeys.has(objectKey("text", textElement.id))}
            isSelected={selectedObjectKeys.has(objectKey("text", textElement.id))}
            onChange={onUpdateTextElement}
            onDelete={onDeleteTextElement}
            onSizeChange={onUpdateTextElementSize}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, textElement.id, side)
            }
            onPointerDown={(event) => {
              onSelectObject?.(event, "text", textElement.id);
              onStartDrag(event, "text", textElement.id, position);
            }}
            onResizePointerDown={(event) =>
              onStartResize(event, "text", textElement.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "text", textElement.id)
            }
          />
        );
      })}
    </>
  );
}
