import React from "react";
import type {
  CanvasConnectionSide,
  CanvasNote,
  CanvasObjectGeometry,
  CanvasTextElement,
  CanvasTextSize,
  FolioItem,
  ThumbnailUrls,
} from "../../types";
import type { ItemDetailsOpenHandler } from "../folio/types";
import {
  CanvasItemCard,
  CanvasNoteCard,
  CanvasTextCard,
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

type CanvasObjectLayerProps = {
  activeItems: FolioItem[];
  activeNotes: CanvasNote[];
  activeTexts: CanvasTextElement[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  positionForItem: (item: FolioItem, index: number) => CanvasObjectGeometry;
  positionForNote: (note: CanvasNote) => CanvasObjectGeometry;
  positionForText: (textElement: CanvasTextElement) => CanvasObjectGeometry;
  onDeleteNote: (noteId: string) => void;
  onDeleteTextElement: (textElementId: string) => void;
  onOpenItem: ItemDetailsOpenHandler;
  onRemoveItem: (itemId: string) => void;
  onStartConnectorDrag: StartConnectorDragHandler;
  onStartDrag: StartObjectDragHandler;
  onStartResize: StartObjectResizeHandler;
  onSuppressClickAfterDrag: SuppressClickAfterDragHandler;
  onUpdateNote: (noteId: string, text: string) => void;
  onUpdateTextElement: (textElementId: string, text: string) => void;
  onUpdateTextElementSize: (
    textElementId: string,
    size: CanvasTextSize,
  ) => void;
};

export function CanvasObjectLayer({
  activeItems,
  activeNotes,
  activeTexts,
  thumbUrls,
  setThumbUrls,
  positionForItem,
  positionForNote,
  positionForText,
  onDeleteNote,
  onDeleteTextElement,
  onOpenItem,
  onRemoveItem,
  onStartConnectorDrag,
  onStartDrag,
  onStartResize,
  onSuppressClickAfterDrag,
  onUpdateNote,
  onUpdateTextElement,
  onUpdateTextElementSize,
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
            onResizePointerDown={(event) =>
              onStartResize(event, "item", item.id, position)
            }
            onClickCapture={(event) =>
              onSuppressClickAfterDrag(event, "item", item.id)
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
            onChange={onUpdateTextElement}
            onDelete={onDeleteTextElement}
            onSizeChange={onUpdateTextElementSize}
            onConnectorPointerDown={(event, side) =>
              onStartConnectorDrag(event, textElement.id, side)
            }
            onPointerDown={(event) =>
              onStartDrag(event, "text", textElement.id, position)
            }
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
