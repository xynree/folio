import React from "react";
import type {
  CanvasConnectionSide,
  CanvasNote,
  CanvasPosition,
  CanvasReference,
  CanvasTextElement,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import type { ItemDetailsOpenHandler } from "../folio/types";
import {
  CanvasItemCard,
  CanvasNoteCard,
  CanvasTextCard,
  ReferenceCard,
} from "./CanvasCards";
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
  startPosition: CanvasPosition,
) => void;

type SuppressClickAfterDragHandler = (
  event: React.MouseEvent,
  kind: CanvasObjectKind,
  objectId: string,
) => void;

type CanvasObjectLayerProps = {
  activeItems: FolioItem[];
  activeNotes: CanvasNote[];
  activeReferences: CanvasReference[];
  activeTexts: CanvasTextElement[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  positionForItem: (item: FolioItem, index: number) => CanvasPosition;
  positionForNote: (note: CanvasNote) => CanvasPosition;
  positionForReference: (reference: CanvasReference) => CanvasPosition;
  positionForText: (textElement: CanvasTextElement) => CanvasPosition;
  onDeleteNote: (noteId: string) => void;
  onDeleteTextElement: (textElementId: string) => void;
  onOpenItem: ItemDetailsOpenHandler;
  onRemoveItem: (itemId: string) => void;
  onRemoveReference: (referenceId: string) => void;
  onStartConnectorDrag: StartConnectorDragHandler;
  onStartDrag: StartObjectDragHandler;
  onSuppressClickAfterDrag: SuppressClickAfterDragHandler;
  onUpdateNote: (noteId: string, text: string) => void;
  onUpdateTextElement: (textElementId: string, text: string) => void;
};

export function CanvasObjectLayer({
  activeItems,
  activeNotes,
  activeReferences,
  activeTexts,
  thumbUrls,
  setThumbUrls,
  positionForItem,
  positionForNote,
  positionForReference,
  positionForText,
  onDeleteNote,
  onDeleteTextElement,
  onOpenItem,
  onRemoveItem,
  onRemoveReference,
  onStartConnectorDrag,
  onStartDrag,
  onSuppressClickAfterDrag,
  onUpdateNote,
  onUpdateTextElement,
}: CanvasObjectLayerProps) {
  return (
    <>
      {activeItems.map((item, index) => {
        const position = positionForItem(item, index);
        return (
          <CanvasItemCard
            item={item}
            key={item.id}
            position={position}
            thumbUrls={thumbUrls}
            setThumbUrls={setThumbUrls}
            onOpen={onOpenItem}
            onRemove={onRemoveItem}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, item.id, side)
            }
            onPointerDown={(event) =>
              onStartDrag(event, "item", item.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "item", item.id)
            }
          />
        );
      })}

      {activeReferences.map((reference) => {
        const position = positionForReference(reference);
        return (
          <ReferenceCard
            key={reference.id}
            reference={reference}
            position={position}
            onRemove={onRemoveReference}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, reference.id, side)
            }
            onPointerDown={(event) =>
              onStartDrag(event, "reference", reference.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "reference", reference.id)
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
            onChange={onUpdateNote}
            onDelete={onDeleteNote}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, note.id, side)
            }
            onPointerDown={(event) =>
              onStartDrag(event, "note", note.id, position)
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
            onChange={onUpdateTextElement}
            onDelete={onDeleteTextElement}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, textElement.id, side)
            }
            onPointerDown={(event) =>
              onStartDrag(event, "text", textElement.id, position)
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
