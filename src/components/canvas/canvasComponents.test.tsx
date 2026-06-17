import React, { useRef, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { makeCanvas, makeItem } from "../../test/fixtures";
import type { ThumbnailUrls } from "../../types";
import { BoardBrowser } from "./BoardBrowser";
import { BoardEditDialog } from "./BoardEditDialog";
import { CanvasBoardHeader } from "./CanvasBoardHeader";
import {
  CanvasItemCard,
  CanvasLinkCard,
  CanvasNoteCard,
  CanvasSectionFrame,
  CanvasTextCard,
} from "./CanvasCards";
import { CanvasEdgeLabels } from "./CanvasEdgeLabels";
import { CanvasInkLayer } from "./CanvasInkLayer";
import { CanvasLinkPrompt } from "./CanvasLinkPrompt";
import { CanvasMinimap } from "./CanvasMinimap";
import { CanvasObjectLayer } from "./CanvasObjectLayer";
import { CanvasSelectionBar } from "./CanvasSelectionBar";
import { CanvasToolCursor } from "./CanvasToolCursor";
import { CanvasViewport } from "./CanvasViewport";
import { edgeRenderModelsFromLayouts, objectLayoutFromPosition } from "./canvasGeometry";
import type { CanvasTool } from "./canvasTypes";

const item = makeItem("alpha", { title: "Alpha" });
const thumbUrls: ThumbnailUrls = { alpha: "folio://thumb/alpha.jpg" };
const board = makeCanvas("board-1", {
  title: "Board",
  color: "#385d56",
  createdAt: "2026-06-15T12:00:00.000Z",
  updatedAt: "2026-06-15T12:30:00.000Z",
  itemIds: ["alpha"],
  notes: [{ id: "note-1", text: "Note", x: 30, y: 40 }],
  texts: [{ id: "text-1", text: "Text", x: 70, y: 80 }],
});

describe("canvas components", () => {
  it("edits board settings from the board dialog", () => {
    const onSave = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    const onTitle = vi.fn();
    const onColor = vi.fn();

    render(
      <BoardEditDialog
        boardColorDraft="#385d56"
        boardTitleDraft="Board"
        canvas={board}
        onBoardColorDraftChange={onColor}
        onBoardTitleDraftChange={onTitle}
        onClose={onClose}
        onDelete={onDelete}
        onSave={onSave}
      />,
    );

    fireEvent.change(screen.getByDisplayValue("Board"), {
      target: { value: "Process" },
    });
    fireEvent.keyDown(screen.getByDisplayValue("Board"), { key: "Enter" });
    fireEvent.change(screen.getByLabelText("Board color"), {
      target: { value: "#111111" },
    });
    fireEvent.click(screen.getByLabelText("Delete board"));
    fireEvent.click(screen.getByLabelText("Close board tools"));

    expect(onTitle).toHaveBeenCalledWith("Process");
    expect(onColor).toHaveBeenCalledWith("#111111");
    expect(onSave).toHaveBeenCalledWith(board);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders board browser grid actions and board edit state", () => {
    const onOpenCanvas = vi.fn();
    const onEditCanvas = vi.fn();
    const onDeleteBoardById = vi.fn();
    const onCreateBoard = vi.fn();

    render(
      <BoardBrowser
        activeCanvasId="board-1"
        boardColorDraft="#385d56"
        boardDropCanvasId={null}
        boardMenuCanvasId="board-1"
        boardTitleDraft="Board"
        browserEditCanvas={board}
        canvases={[board]}
        itemsById={new Map([["alpha", item]])}
        thumbUrls={thumbUrls}
        setThumbUrls={vi.fn()}
        onAddDraggedItemsToBoard={vi.fn()}
        onBoardColorDraftChange={vi.fn()}
        onBoardTileDragLeave={vi.fn()}
        onBoardTileDragOver={vi.fn()}
        onBoardTitleDraftChange={vi.fn()}
        onCloseBrowserEditCanvas={vi.fn()}
        onCreateBoard={onCreateBoard}
        onDeleteBoardById={onDeleteBoardById}
        onEditCanvas={onEditCanvas}
        onOpenCanvas={onOpenCanvas}
        onSaveBoardSettings={vi.fn()}
        onToggleBoardMenu={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Template"), {
      target: { value: "moodboard" },
    });
    fireEvent.click(screen.getByText("New board"));
    fireEvent.click(screen.getByLabelText(/Open Board/));
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Delete"));

    expect(onCreateBoard).toHaveBeenCalledWith("moodboard");
    expect(onOpenCanvas).toHaveBeenCalledWith("board-1");
    expect(onEditCanvas).toHaveBeenCalledWith("board-1");
    expect(onDeleteBoardById).toHaveBeenCalledWith("board-1");
    expect(screen.getByRole("dialog", { name: "Edit board" })).not.toBeNull();
  });

  it("renders board browser empty state", () => {
    render(
      <BoardBrowser
        activeCanvasId={null}
        boardColorDraft="#385d56"
        boardDropCanvasId={null}
        boardMenuCanvasId={null}
        boardTitleDraft=""
        browserEditCanvas={null}
        canvases={[]}
        itemsById={new Map()}
        thumbUrls={{}}
        setThumbUrls={vi.fn()}
        onAddDraggedItemsToBoard={vi.fn()}
        onBoardColorDraftChange={vi.fn()}
        onBoardTileDragLeave={vi.fn()}
        onBoardTileDragOver={vi.fn()}
        onBoardTitleDraftChange={vi.fn()}
        onCloseBrowserEditCanvas={vi.fn()}
        onCreateBoard={vi.fn()}
        onDeleteBoardById={vi.fn()}
        onEditCanvas={vi.fn()}
        onOpenCanvas={vi.fn()}
        onSaveBoardSettings={vi.fn()}
        onToggleBoardMenu={vi.fn()}
      />,
    );

    expect(document.querySelector(".canvas-board-preview")).not.toBeNull();
  });

  it("dispatches board header tool and action callbacks", () => {
    const onFitContent = vi.fn();
    const onAddLink = vi.fn();
    const onResetZoom = vi.fn();
    const onToggleBoardTools = vi.fn();
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();

    function Harness() {
      const [activeTool, setActiveTool] = useState<CanvasTool>("select");
      return (
        <CanvasBoardHeader
          activeCanvas={board}
          activeStrokeCount={1}
          activeTool={activeTool}
          boardColorDraft="#385d56"
          boardSearchQuery=""
          boardTitleDraft="Board"
          boardToolsOpen
          canvasZoom={0.75}
          projectImageCount={3}
          projectImagePickerOpen
          onActiveToolChange={setActiveTool}
          onAddLink={onAddLink}
          onAddNote={vi.fn()}
          onBackToBoards={vi.fn()}
          onBoardColorDraftChange={vi.fn()}
          onBoardSearchQueryChange={vi.fn()}
          onBoardTitleDraftChange={vi.fn()}
          onDeleteBoard={vi.fn()}
          onFitContent={onFitContent}
          onImportImages={vi.fn()}
          onOpenBoardFolder={vi.fn()}
          onResetZoom={onResetZoom}
          onSaveBoardSettings={vi.fn()}
          onToggleBoardTools={onToggleBoardTools}
          onToggleProjectImages={vi.fn()}
          onUndoStroke={vi.fn()}
          onZoomIn={onZoomIn}
          onZoomOut={onZoomOut}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByText(/Created/).textContent).toContain("Last saved");
    fireEvent.click(screen.getByLabelText("Pen tool"));
    expect(screen.getByLabelText("Pen tool").getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByLabelText("Connect tool"));
    expect(screen.getByLabelText("Connect tool").getAttribute("aria-pressed"))
      .toBe("true");
    fireEvent.click(screen.getByLabelText("Add link"));
    fireEvent.click(screen.getByRole("button", { name: "Edit board" }));
    fireEvent.click(screen.getByLabelText("Zoom out"));
    fireEvent.click(screen.getByLabelText("Reset zoom"));
    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Fit content"));
    expect(screen.getByLabelText("Reset zoom").textContent).toBe("75%");
    expect(screen.getByLabelText("Search board")).not.toBeNull();
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(onResetZoom).toHaveBeenCalledTimes(1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(onFitContent).toHaveBeenCalledTimes(1);
    expect(onAddLink).toHaveBeenCalledTimes(1);
    expect(onToggleBoardTools).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Section tool")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit board" })).not.toBeNull();
  });

  it("renders and edits edge labels and actions", () => {
    const edge = {
      id: "edge-1",
      fromId: "alpha",
      toId: "note-1",
      direction: "forward" as const,
      label: "Link",
    };
    const model = {
      edge,
      path: "M 0 0 L 100 100",
      labelPosition: { x: 50, y: 50 },
      direction: "forward" as const,
    };
    const onSelectEdge = vi.fn();
    const onStartEdgeLabelEdit = vi.fn();
    const onUpdateEdgeDirection = vi.fn();
    const onReverseEdgeDirection = vi.fn();
    const onDeleteEdge = vi.fn();

    const { rerender } = render(
      <CanvasEdgeLabels
        edgeLabelDraft=""
        edgeRenderModels={[model]}
        editingEdgeId={null}
        selectedEdgeId="edge-1"
        onDeleteEdge={onDeleteEdge}
        onEdgeLabelDraftChange={vi.fn()}
        onReverseEdgeDirection={onReverseEdgeDirection}
        onSaveEdgeLabel={vi.fn()}
        onSelectEdge={onSelectEdge}
        onStartEdgeLabelEdit={onStartEdgeLabelEdit}
        onStopEdgeLabelEdit={vi.fn()}
        onUpdateEdgeDirection={onUpdateEdgeDirection}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "No direction" }));
    fireEvent.click(screen.getByRole("button", { name: "Reverse direction" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove link" }));
    fireEvent.doubleClick(screen.getByRole("button", { name: "Edge label: Link" }));

    expect(onUpdateEdgeDirection).toHaveBeenCalledWith("edge-1", "none");
    expect(onReverseEdgeDirection).toHaveBeenCalledWith("edge-1");
    expect(onDeleteEdge).toHaveBeenCalledWith("edge-1");
    expect(onStartEdgeLabelEdit).toHaveBeenCalledWith(edge);

    const onDraft = vi.fn();
    const onSave = vi.fn();
    const onStop = vi.fn();
    rerender(
      <CanvasEdgeLabels
        edgeLabelDraft="Updated"
        edgeRenderModels={[model]}
        editingEdgeId="edge-1"
        selectedEdgeId="edge-1"
        onDeleteEdge={onDeleteEdge}
        onEdgeLabelDraftChange={onDraft}
        onReverseEdgeDirection={onReverseEdgeDirection}
        onSaveEdgeLabel={onSave}
        onSelectEdge={onSelectEdge}
        onStartEdgeLabelEdit={onStartEdgeLabelEdit}
        onStopEdgeLabelEdit={onStop}
        onUpdateEdgeDirection={onUpdateEdgeDirection}
      />,
    );

    fireEvent.change(screen.getByLabelText("Edge label"), {
      target: { value: "Next" },
    });
    fireEvent.keyDown(screen.getByLabelText("Edge label"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Edge label"), { key: "Escape" });

    expect(onDraft).toHaveBeenCalledWith("Next");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it("renders ink strokes, edges, draft links, and selection callbacks", () => {
    const layouts = new Map([
      ["alpha", objectLayoutFromPosition("alpha", "item", { x: 0, y: 0 })],
      ["note-1", objectLayoutFromPosition("note-1", "note", { x: 300, y: 0 })],
    ]);
    const edge = {
      id: "edge-1",
      fromId: "alpha",
      toId: "note-1",
      fromSide: "right" as const,
      toSide: "left" as const,
      direction: "bidirectional" as const,
    };
    const onSelectEdge = vi.fn();
    const onStartEdgeLabelEdit = vi.fn();

    render(
      <CanvasInkLayer
        activeStrokes={[{ id: "stroke-1", color: "#111111", path: "M 0 0 L 4 4" }]}
        activeTool="eraser"
        canvasObjectLayouts={layouts}
        edgeDraft={{
          fromId: "alpha",
          fromSide: "right",
          toPoint: { x: 250, y: 100 },
        }}
        edgeRenderModels={edgeRenderModelsFromLayouts([edge], layouts)}
        selectedEdgeId="edge-1"
        strokePreview={{ id: "preview", color: "#222222", path: "M 5 5 L 8 8" }}
        onSelectEdge={onSelectEdge}
        onStartEdgeLabelEdit={onStartEdgeLabelEdit}
      />,
    );

    const hitArea = document.querySelector(".canvas-edge-hit-area") as SVGPathElement;
    fireEvent.click(hitArea);
    fireEvent.doubleClick(hitArea);

    expect(document.querySelector(".canvas-stroke-erasable")).not.toBeNull();
    expect(document.querySelector(".canvas-edge-draft")).not.toBeNull();
    expect(onSelectEdge).toHaveBeenCalledWith("edge-1");
    expect(onStartEdgeLabelEdit).toHaveBeenCalledWith(edge);
  });

  it("renders tool cursors for pen and eraser", () => {
    const { rerender } = render(
      <CanvasToolCursor activeTool="pen" position={{ x: 10, y: 20 }} />,
    );

    expect(screen.getByTestId("canvas-tool-cursor").className).toContain(
      "canvas-tool-cursor-pen",
    );

    rerender(<CanvasToolCursor activeTool="eraser" position={{ x: 10, y: 20 }} />);
    expect(document.querySelector(".canvas-eraser-radius")).not.toBeNull();

    rerender(<CanvasToolCursor activeTool="select" position={{ x: 10, y: 20 }} />);
    expect(screen.queryByTestId("canvas-tool-cursor")).toBeNull();
  });

  it("handles canvas item cards", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const onConnector = vi.fn();
    const onPointerDown = vi.fn();
    const onResizePointerDown = vi.fn();
    const onClickCapture = vi.fn();

    render(
      <CanvasItemCard
        item={item}
        position={{ x: 1, y: 2, width: 240, height: 280 }}
        thumbUrls={thumbUrls}
        setThumbUrls={vi.fn()}
        onOpen={onOpen}
        onRemove={onRemove}
        onConnectorPointerDown={onConnector}
        onPointerDown={onPointerDown}
        onResizePointerDown={onResizePointerDown}
        onClickCapture={onClickCapture}
      />,
    );

    const itemCard = document.querySelector(".canvas-card") as HTMLElement;
    const resizeCorner = itemCard.querySelector(
      ".canvas-card-resize-corner",
    ) as HTMLElement;
    expect(screen.queryByText("Alpha")).toBeNull();
    fireEvent.click(itemCard);
    fireEvent.doubleClick(itemCard);
    fireEvent.pointerDown(screen.getByLabelText("Connect Alpha from right"));
    fireEvent.pointerDown(resizeCorner);
    fireEvent.click(screen.getByLabelText("Remove Alpha from board"));

    expect(onOpen).toHaveBeenCalledWith("alpha");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onConnector).toHaveBeenCalledWith(expect.any(Object), "right");
    expect(onResizePointerDown).toHaveBeenCalledWith(expect.any(Object));
    expect(onRemove).toHaveBeenCalledWith("alpha");
    expect(itemCard.style.height).toBe("280px");
    expect(itemCard.style.width).toBe("240px");
  });

  it("handles document, link, and section canvas cards", () => {
    const onOpen = vi.fn();
    const onRemove = vi.fn();
    const onConnector = vi.fn();
    const onResizePointerDown = vi.fn();
    const onLinkChange = vi.fn();
    const onLinkDelete = vi.fn();
    const onSectionChange = vi.fn();
    const onSectionDelete = vi.fn();
    const documentItem = makeItem("brief", {
      title: "Brief",
      type: "text",
      path: "projects/studio-archive/documents/brief.md",
    });

    const { rerender } = render(
      <CanvasItemCard
        item={documentItem}
        kind="document"
        position={{ x: 1, y: 2, width: 190, height: 116 }}
        thumbUrls={{}}
        setThumbUrls={vi.fn()}
        onOpen={onOpen}
        onRemove={onRemove}
        onConnectorPointerDown={onConnector}
        onPointerDown={vi.fn()}
        onResizePointerDown={onResizePointerDown}
        onClickCapture={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByText("Brief"));
    fireEvent.pointerDown(screen.getByTitle("Resize Brief"));
    fireEvent.click(screen.getByLabelText("Remove Brief from board"));

    expect(screen.getByText("MD")).not.toBeNull();
    expect(onOpen).toHaveBeenCalledWith("brief");
    expect(onRemove).toHaveBeenCalledWith("brief");
    expect(onResizePointerDown).toHaveBeenCalledWith(expect.any(Object));

    rerender(
      <CanvasLinkCard
        link={{
          id: "link-1",
          title: "Example",
          description: "",
          sourceDomain: "example.com",
          url: "https://example.com/",
          capturedAt: "2026-06-17T08:00:00.000Z",
          x: 10,
          y: 20,
        }}
        onChange={onLinkChange}
        onDelete={onLinkDelete}
        onConnectorPointerDown={onConnector}
        onPointerDown={vi.fn()}
        onResizePointerDown={onResizePointerDown}
        onClickCapture={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Link title"), {
      target: { value: "Research" },
    });
    fireEvent.blur(screen.getByLabelText("Link title"));
    fireEvent.change(screen.getByLabelText("Link description"), {
      target: { value: "Primary source" },
    });
    fireEvent.blur(screen.getByLabelText("Link description"));
    fireEvent.click(screen.getByLabelText("Delete link"));

    expect(screen.getByRole("link", { name: /open/i }).getAttribute("href"))
      .toBe("https://example.com/");
    expect(onLinkChange).toHaveBeenCalledWith("link-1", {
      title: "Research",
      description: undefined,
    });
    expect(onLinkChange).toHaveBeenCalledWith("link-1", {
      title: "Research",
      description: "Primary source",
    });
    expect(onLinkDelete).toHaveBeenCalledWith("link-1");

    rerender(
      <CanvasLinkCard
        link={{
          id: "link-1",
          title: "Example",
          description: "An example",
          sourceDomain: "example.com",
          url: "https://example.com/",
          faviconUrl: "data:image/png;base64,AAAA",
          imageUrl: "data:image/png;base64,BBBB",
          capturedAt: "2026-06-17T08:00:00.000Z",
          x: 10,
          y: 20,
        }}
        onChange={onLinkChange}
        onDelete={onLinkDelete}
        onConnectorPointerDown={onConnector}
        onPointerDown={vi.fn()}
        onResizePointerDown={onResizePointerDown}
        onClickCapture={vi.fn()}
      />,
    );

    expect(
      document.querySelector(".canvas-link-preview")?.getAttribute("src"),
    ).toBe("data:image/png;base64,BBBB");
    expect(
      document.querySelector(".canvas-link-favicon")?.getAttribute("src"),
    ).toBe("data:image/png;base64,AAAA");

    rerender(
      <CanvasSectionFrame
        section={{
          id: "section-1",
          title: "Research",
          color: "#385d56",
          collapsed: false,
          x: 20,
          y: 30,
          width: 500,
          height: 300,
        }}
        onChange={onSectionChange}
        onDelete={onSectionDelete}
        onConnectorPointerDown={onConnector}
        onPointerDown={vi.fn()}
        onResizePointerDown={onResizePointerDown}
        onClickCapture={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Section title"), {
      target: { value: "Sources" },
    });
    fireEvent.blur(screen.getByLabelText("Section title"));
    fireEvent.click(screen.getByLabelText("Collapse section"));
    fireEvent.click(screen.getByLabelText("Delete section"));

    expect(onSectionChange).toHaveBeenCalledWith("section-1", { title: "Sources" });
    expect(onSectionChange).toHaveBeenCalledWith("section-1", { collapsed: true });
    expect(onSectionDelete).toHaveBeenCalledWith("section-1");
  });

  it("saves note drafts on blur and text drafts after debounce", () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    const onDelete = vi.fn();
    const onConnector = vi.fn();
    const onResizePointerDown = vi.fn();
    const onSizeChange = vi.fn();

    try {
      const { rerender } = render(
        <CanvasNoteCard
          note={board.notes[0]}
          onChange={onChange}
          onDelete={onDelete}
          onSizeChange={onSizeChange}
          onConnectorPointerDown={onConnector}
          onPointerDown={vi.fn()}
          onResizePointerDown={onResizePointerDown}
          onClickCapture={vi.fn()}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText("Note"), {
        target: { value: "Updated note" },
      });
      fireEvent.blur(screen.getByPlaceholderText("Note"));
      fireEvent.click(screen.getByLabelText("Large note text"));
      fireEvent.change(screen.getByPlaceholderText("Note"), { target: { value: "" } });
      fireEvent.blur(screen.getByPlaceholderText("Note"));

      rerender(
        <CanvasTextCard
          textElement={
            board.texts?.[0] ?? { id: "text-1", text: "Text", x: 0, y: 0 }
          }
          onChange={onChange}
          onDelete={onDelete}
          onSizeChange={onSizeChange}
          onConnectorPointerDown={onConnector}
          onPointerDown={vi.fn()}
          onResizePointerDown={onResizePointerDown}
          onClickCapture={vi.fn()}
        />,
      );
      fireEvent.change(screen.getByLabelText("Board text"), {
        target: { value: "Updated text" },
      });
      expect(onChange).not.toHaveBeenCalledWith("text-1", "Updated text");
      act(() => {
        vi.advanceTimersByTime(500);
      });
      const textBox = document.querySelector(".canvas-text-card") as HTMLElement;
      const textResizeCorner = textBox.querySelector(
        ".canvas-card-resize-corner",
      ) as HTMLElement;
      fireEvent.pointerDown(textResizeCorner);
      fireEvent.click(screen.getByLabelText("Large text"));
      fireEvent.click(screen.getByLabelText("Delete text"));

      expect(onChange).toHaveBeenCalledWith("note-1", "Updated note");
      expect(onChange).toHaveBeenCalledWith("text-1", "Updated text");
      expect(onResizePointerDown).toHaveBeenCalledWith(expect.any(Object));
      expect(onSizeChange).toHaveBeenCalledWith("note-1", "large");
      expect(onSizeChange).toHaveBeenCalledWith("text-1", "large");
      expect(onDelete).toHaveBeenCalledWith("note-1");
      expect(onDelete).toHaveBeenCalledWith("text-1");
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders object layer and forwards object interactions", () => {
    const onOpenItem = vi.fn();
    const onSelectObject = vi.fn();
    const onStartDrag = vi.fn();
    const onStartResize = vi.fn();
    const onSuppressClickAfterDrag = vi.fn();

    render(
      <CanvasObjectLayer
        activeItems={[item]}
        activeLinks={[
          {
            id: "link-1",
            title: "Example",
            url: "https://example.com/",
            capturedAt: "2026-06-17T08:00:00.000Z",
            x: 80,
            y: 90,
          },
        ]}
        activeNotes={board.notes}
        activeSections={[
          { id: "section-1", title: "Research", x: 0, y: 0, width: 500, height: 300 },
        ]}
        activeTexts={board.texts ?? []}
        matchedObjectKeys={new Set(["link:link-1"])}
        selectedObjectKeys={new Set(["section:section-1", "text:text-1"])}
        thumbUrls={thumbUrls}
        setThumbUrls={vi.fn()}
        positionForItem={() => ({ x: 1, y: 2, width: 210, height: 246 })}
        positionForLink={(link) => ({ x: link.x, y: link.y })}
        positionForNote={(note) => ({ x: note.x, y: note.y })}
        positionForSection={(section) => ({ x: section.x, y: section.y })}
        positionForText={(textElement) => ({ x: textElement.x, y: textElement.y })}
        onDeleteLink={vi.fn()}
        onDeleteNote={vi.fn()}
        onDeleteSection={vi.fn()}
        onDeleteTextElement={vi.fn()}
        onOpenItem={onOpenItem}
        onRemoveItem={vi.fn()}
        onSelectObject={onSelectObject}
        onStartConnectorDrag={vi.fn()}
        onStartDrag={onStartDrag}
        onStartResize={onStartResize}
        onSuppressClickAfterDrag={onSuppressClickAfterDrag}
        onUpdateLink={vi.fn()}
        onUpdateNote={vi.fn()}
        onUpdateSection={vi.fn()}
        onUpdateTextElement={vi.fn()}
        onUpdateTextElementSize={vi.fn()}
      />,
    );

    const itemCard = document.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    const resizeCorner = itemCard.querySelector(
      ".canvas-card-resize-corner",
    ) as HTMLElement;

    fireEvent.pointerDown(itemCard);
    fireEvent.pointerDown(resizeCorner);
    fireEvent.doubleClick(itemCard);
    fireEvent.pointerDown(
      document.querySelector('[data-canvas-object-id="link-1"]') as HTMLElement,
    );
    fireEvent.pointerDown(
      document.querySelector('[data-canvas-object-id="note-1"]') as HTMLElement,
    );
    fireEvent.pointerDown(
      document.querySelector('[data-canvas-object-id="section-1"]') as HTMLElement,
    );
    fireEvent.pointerDown(
      document.querySelector('[data-canvas-object-id="text-1"]') as HTMLElement,
    );

    expect(onStartDrag).toHaveBeenCalledWith(
      expect.any(Object),
      "item",
      "alpha",
      { x: 1, y: 2, width: 210, height: 246 },
    );
    expect(onStartResize).toHaveBeenCalledWith(
      expect.any(Object),
      "item",
      "alpha",
      { x: 1, y: 2, width: 210, height: 246 },
    );
    expect(onOpenItem).toHaveBeenCalledWith("alpha");
    expect(document.querySelector('[data-canvas-object-id="link-1"]')).not.toBeNull();
    expect(document.querySelector('[data-canvas-object-id="section-1"]')).not.toBeNull();
    expect(onSelectObject).toHaveBeenCalledWith(expect.any(Object), "link", "link-1");
    expect(onSelectObject).toHaveBeenCalledWith(expect.any(Object), "note", "note-1");
    expect(onSelectObject).toHaveBeenCalledWith(
      expect.any(Object),
      "section",
      "section-1",
    );
    expect(onSelectObject).toHaveBeenCalledWith(expect.any(Object), "text", "text-1");
    expect(
      document.querySelector('[data-canvas-object-id="link-1"]')?.className,
    ).toContain("canvas-object-search-match");
    expect(
      document.querySelector('[data-canvas-object-id="section-1"]')?.className,
    ).toContain("canvas-object-selected");
  });

  it("renders selection bar actions and a minimap when content overflows", () => {
    const onDuplicate = vi.fn();
    const scroll = document.createElement("div");
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 180 },
      clientWidth: { configurable: true, value: 220 },
      scrollLeft: { configurable: true, value: 20, writable: true },
      scrollTop: { configurable: true, value: 30, writable: true },
    });
    scroll.getBoundingClientRect = () =>
      ({
        bottom: 180,
        height: 180,
        left: 0,
        right: 220,
        top: 0,
        width: 220,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    const scrollRef = { current: scroll };
    const onFocusViewport = vi.fn();

    render(
      <>
        <CanvasSelectionBar
          selectedCount={2}
          onDelete={vi.fn()}
          onDuplicate={onDuplicate}
        />
        <CanvasMinimap
          objectViews={[
            {
              id: "alpha",
              kind: "item",
              title: "Alpha",
              geometry: { x: 0, y: 0, width: 120, height: 120 },
              connectable: true,
              selectable: true,
            },
            {
              id: "section-1",
              kind: "section",
              title: "Research",
              geometry: { x: 640, y: 420, width: 360, height: 240 },
              connectable: true,
              selectable: true,
            },
          ]}
          scrollRef={scrollRef}
          zoom={1}
          onFocusViewport={onFocusViewport}
        />
      </>,
    );

    fireEvent.click(screen.getByLabelText("Duplicate"));

    expect(screen.getByText("2 selected")).not.toBeNull();
    const minimap = screen.getByLabelText("Minimap");
    expect(minimap).not.toBeNull();

    minimap.getBoundingClientRect = () =>
      ({
        bottom: 116,
        height: 116,
        left: 0,
        right: 164,
        top: 0,
        width: 164,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.pointerDown(minimap, { button: 0, clientX: 90, clientY: 70 });
    fireEvent.pointerMove(window, { clientX: 110, clientY: 80 });
    fireEvent.pointerUp(window);

    expect(onFocusViewport).toHaveBeenCalled();
    expect(onDuplicate).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Organize into section")).toBeNull();
  });

  it("submits, validates, and cancels the link prompt", () => {
    const onSubmit = vi.fn((url: string) => url.startsWith("http"));
    const onCancel = vi.fn();
    const { rerender } = render(
      <CanvasLinkPrompt onSubmit={onSubmit} onCancel={onCancel} />,
    );

    const input = screen.getByLabelText("Link URL") as HTMLInputElement;
    const submit = screen.getByText("Add link");

    // Empty input keeps the submit button disabled.
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    // A rejected URL surfaces an inline error and keeps the prompt open.
    fireEvent.change(input, { target: { value: "not-a-link" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("not-a-link");
    expect(screen.getByRole("alert")).not.toBeNull();

    // Editing clears the error, and a valid URL submits.
    fireEvent.change(input, { target: { value: "https://example.com" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledWith("https://example.com");

    // Escape and backdrop clicks cancel.
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);

    rerender(<CanvasLinkPrompt onSubmit={onSubmit} onCancel={onCancel} />);
    fireEvent.pointerDown(
      document.querySelector(".canvas-link-prompt-backdrop") as HTMLElement,
    );
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("zooms and pans the canvas viewport", () => {
    const zoomRef = { current: 1 };
    const onZoomChange = vi.fn();
    const onViewportChange = vi.fn();

    function ViewportHarness() {
      const scrollRef = useRef<HTMLDivElement | null>(null);
      const surfaceRef = useRef<HTMLDivElement | null>(null);
      return (
        <CanvasViewport
          zoom={1}
          zoomRef={zoomRef}
          onZoomChange={onZoomChange}
          scrollRef={scrollRef}
          surfaceRef={surfaceRef}
          onDrop={vi.fn()}
          onDragOver={vi.fn()}
          onViewportChange={onViewportChange}
        >
          <span>Canvas child</span>
        </CanvasViewport>
      );
    }

    const { container } = render(<ViewportHarness />);
    const scroll = container.querySelector(".canvas-scroll") as HTMLDivElement;
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 1000 },
      scrollWidth: { configurable: true, value: 1000 },
      scrollLeft: { configurable: true, value: 100, writable: true },
      scrollTop: { configurable: true, value: 100, writable: true },
    });
    scroll.getBoundingClientRect = () =>
      ({
        bottom: 300,
        height: 300,
        left: 0,
        right: 400,
        top: 0,
        width: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.wheel(scroll, { clientX: 200, clientY: 150, deltaY: -80 });
    fireEvent.pointerDown(scroll, { button: 0, clientX: 200, clientY: 150 });
    fireEvent.pointerMove(window, { clientX: 220, clientY: 170 });
    fireEvent.pointerUp(window);

    expect(onZoomChange).toHaveBeenCalled();
    expect(onViewportChange).toHaveBeenCalled();
    expect(screen.getByText("Canvas child")).not.toBeNull();
  });
});
