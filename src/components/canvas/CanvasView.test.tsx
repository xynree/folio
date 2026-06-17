import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeCanvas, makeData, makeItem } from "../../test/fixtures";
import type { FolioData, ThumbnailUrls } from "../../types";
import { CanvasView } from "./CanvasView";

function setCanvasMeasurements(container: HTMLElement) {
  const scroll = container.querySelector(".canvas-scroll") as HTMLDivElement;
  const surface = container.querySelector(".canvas-surface") as HTMLDivElement;

  Object.defineProperties(scroll, {
    clientHeight: { configurable: true, value: 420 },
    clientWidth: { configurable: true, value: 640 },
    scrollLeft: { configurable: true, value: 20000, writable: true },
    scrollTop: { configurable: true, value: 20000, writable: true },
  });
  scroll.getBoundingClientRect = () =>
    ({
      bottom: 420,
      height: 420,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
  surface.getBoundingClientRect = () =>
    ({
      bottom: 40000,
      height: 40000,
      left: 0,
      right: 40000,
      top: 0,
      width: 40000,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  return { scroll, surface };
}

function renderCanvasView(initialData: FolioData = makeData()) {
  const setActiveCanvasId = vi.fn();
  const onOpenItem = vi.fn();
  const clearDragState = vi.fn();

  function Harness() {
    const [data, setData] = useState(initialData);
    const [thumbUrls, setThumbUrls] = useState<ThumbnailUrls>({
      alpha: "folio://thumb/alpha.jpg",
    });

    return (
      <CanvasView
        data={data}
        activeCanvasId="board-1"
        activeProjectId="project-1"
        canvasDetailRequestId={1}
        setActiveCanvasId={setActiveCanvasId}
        onOpenItem={onOpenItem}
        onCreateBoard={vi.fn()}
        thumbUrls={thumbUrls}
        setThumbUrls={setThumbUrls}
        clearDragState={clearDragState}
        commitData={(updater) => setData((current) => updater(current))}
        saveData={(nextData) => setData(nextData)}
      />
    );
  }

  const rendered = render(<Harness />);
  return { ...rendered, clearDragState, onOpenItem, setActiveCanvasId };
}

describe("CanvasView Phase 5 interactions", () => {
  it("imports files from the board toolbar and adds existing project images", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    vi.mocked(window.folio.importToProject).mockResolvedValue([
      makeItem("delta", {
        title: "Delta",
        date: "2026-06-15T11:00:00.000Z",
        projectId: "project-1",
      }),
    ]);
    const { container } = renderCanvasView();
    setCanvasMeasurements(container);

    fireEvent.click(screen.getByLabelText("Import images and files"));
    fireEvent.click(screen.getByLabelText("Add images"));

    expect(await screen.findByTitle("Delta")).not.toBeNull();
    expect(window.folio.importToProject).toHaveBeenCalledWith("project-1");

    fireEvent.click(screen.getByLabelText("Add Bravo to board"));

    await waitFor(() => {
      expect(container.querySelector('[data-canvas-object-id="bravo"]')).not.toBeNull();
    });

    fireEvent.click(screen.getAllByLabelText("Remove Bravo from board")[0]);

    await waitFor(() => {
      expect(container.querySelector('[data-canvas-object-id="bravo"]')).toBeNull();
    });
  });

  it("creates link and text cards from dropped and pasted text", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const { container } = renderCanvasView();
    const { surface } = setCanvasMeasurements(container);

    fireEvent.drop(surface, {
      clientX: 240,
      clientY: 260,
      dataTransfer: {
        files: [],
        getData: (type: string) =>
          type === "text/uri-list" ? "https://example.com/research" : "",
      },
    });

    expect(await screen.findByDisplayValue("example.com")).not.toBeNull();

    fireEvent.paste(window, {
      clipboardData: {
        files: [],
        getData: () => "Plain board note",
      },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Plain board note")).not.toBeNull();
    });
  });

  it("imports dropped documents into the active project and places document cards", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    vi.mocked(window.folio.getPathForFile).mockReturnValue("/tmp/brief.md");
    vi.mocked(window.folio.copyToProject).mockResolvedValue([
      makeItem("brief", {
        title: "Brief",
        type: "text",
        path: "projects/studio-archive/documents/brief.md",
        projectId: "project-1",
      }),
    ]);
    const { container } = renderCanvasView();
    const { surface } = setCanvasMeasurements(container);

    fireEvent.drop(surface, {
      clientX: 260,
      clientY: 280,
      dataTransfer: {
        files: [new File(["# Brief"], "brief.md", { type: "text/markdown" })],
        getData: () => "",
      },
    });

    expect(await screen.findByText("Brief")).not.toBeNull();
    expect(window.folio.copyToProject).toHaveBeenCalledWith("project-1", [
      "/tmp/brief.md",
    ]);
  });

  it("adds clipboard files to the board through project import", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    vi.mocked(window.folio.getPathForFile).mockReturnValue("/tmp/source.pdf");
    vi.mocked(window.folio.copyToProject).mockResolvedValue([
      makeItem("source-pdf", {
        title: "Source PDF",
        type: "text",
        path: "projects/studio-archive/documents/source.pdf",
        projectId: "project-1",
      }),
    ]);
    const { container } = renderCanvasView();
    setCanvasMeasurements(container);

    fireEvent.paste(window, {
      clipboardData: {
        files: [new File(["pdf"], "source.pdf", { type: "application/pdf" })],
        getData: () => "",
      },
    });

    expect(await screen.findByText("Source PDF")).not.toBeNull();
    expect(window.folio.copyToProject).toHaveBeenCalledWith("project-1", [
      "/tmp/source.pdf",
    ]);
  });

  it("uses board zoom controls and fit-to-content", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const { container } = renderCanvasView();
    setCanvasMeasurements(container);

    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Zoom out"));
    fireEvent.click(screen.getByLabelText("Reset zoom"));
    fireEvent.click(screen.getByLabelText("Fit content"));

    await waitFor(() => {
      expect(screen.getByLabelText("Reset zoom").textContent).toMatch(/%/);
    });
  });

  it("creates text from the text tool and links from the link action", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    vi.mocked(window.folio.fetchLinkMetadata).mockResolvedValue({
      url: "https://example.com/source",
      title: "Example Source",
      description: "A fetched description",
      sourceDomain: "example.com",
      imageUrl: "data:image/png;base64,PREVIEW",
      faviconUrl: "data:image/png;base64,ICON",
    });
    const { container } = renderCanvasView();
    const { surface } = setCanvasMeasurements(container);

    fireEvent.click(screen.getByLabelText("Text tool"));
    fireEvent.pointerDown(surface, { button: 0, clientX: 300, clientY: 310 });
    fireEvent.click(screen.getByLabelText("Add link"));

    const linkInput = await screen.findByLabelText("Link URL");
    fireEvent.change(linkInput, { target: { value: "example.com/source" } });
    fireEvent.click(
      container.querySelector(".canvas-link-prompt-submit") as HTMLElement,
    );

    expect(await screen.findByDisplayValue("Text")).not.toBeNull();
    expect(await screen.findByDisplayValue("Example Source")).not.toBeNull();
    expect(
      container.querySelector(".canvas-link-preview")?.getAttribute("src"),
    ).toBe("data:image/png;base64,PREVIEW");
    expect(screen.queryByLabelText("Section tool")).not.toBeNull();
    expect(screen.queryByLabelText("Link URL")).toBeNull();
    expect(window.folio.fetchLinkMetadata).toHaveBeenCalledWith(
      "https://example.com/source",
    );
  });

  it("selects objects with a drag marquee and reserves space-drag for panning", () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const data = makeData({
      canvases: [
        makeCanvas("board-1", {
          title: "Board 1",
          itemIds: ["alpha"],
          positions: { alpha: { x: 80, y: 90, width: 160, height: 180 } },
        }),
      ],
    });
    const { container } = renderCanvasView(data);
    const { surface } = setCanvasMeasurements(container);

    fireEvent.pointerDown(surface, { button: 0, clientX: 20000, clientY: 20000 });
    fireEvent.pointerMove(window, { clientX: 20400, clientY: 20400 });
    expect(container.querySelector(".canvas-selection-marquee")).not.toBeNull();
    fireEvent.pointerUp(window, { clientX: 20400, clientY: 20400 });

    expect(screen.getByText("1 selected")).not.toBeNull();
    expect(container.querySelector(".canvas-selection-marquee")).toBeNull();

    // Holding space turns a left drag into a pan, so no marquee should appear.
    fireEvent.keyDown(window, { key: " " });
    fireEvent.pointerDown(surface, { button: 0, clientX: 20000, clientY: 20000 });
    fireEvent.pointerMove(window, { clientX: 20300, clientY: 20300 });
    expect(container.querySelector(".canvas-selection-marquee")).toBeNull();
    fireEvent.pointerUp(window, { clientX: 20300, clientY: 20300 });
    fireEvent.keyUp(window, { key: " " });
  });

  it("creates a section with the section tool and moves its contents together", () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const data = makeData({
      canvases: [
        makeCanvas("board-1", {
          title: "Board 1",
          itemIds: ["alpha"],
          positions: { alpha: { x: 80, y: 90, width: 160, height: 180 } },
        }),
      ],
    });
    const { container } = renderCanvasView(data);
    const { surface } = setCanvasMeasurements(container);

    // Draw a section over the empty space up and to the left of the item.
    fireEvent.click(screen.getByLabelText("Section tool"));
    fireEvent.pointerDown(surface, { button: 0, clientX: 20000, clientY: 20000 });

    const sectionFrame = container.querySelector(
      '[data-canvas-object-kind="section"]',
    ) as HTMLElement;
    expect(sectionFrame).not.toBeNull();

    const itemBefore = container.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    expect(itemBefore.style.transform).toContain("translate(20080px, 20090px)");

    // Dragging the section moves the contained item by the same delta.
    fireEvent.pointerDown(sectionFrame, {
      button: 0,
      clientX: 20010,
      clientY: 20010,
    });
    fireEvent.pointerMove(window, { clientX: 20060, clientY: 20070 });
    fireEvent.pointerUp(window, { clientX: 20060, clientY: 20070 });

    const itemAfter = container.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    expect(itemAfter.style.transform).toContain("translate(20130px, 20150px)");
  });

  it("changes the project image grid size from the picker", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const { container } = renderCanvasView();
    setCanvasMeasurements(container);

    fireEvent.click(screen.getByLabelText("Add images"));

    const imageList = container.querySelector(
      ".canvas-project-image-list",
    ) as HTMLElement;
    expect(imageList.style.gridTemplateColumns).toBe(
      "repeat(2, minmax(0, 1fr))",
    );

    fireEvent.click(screen.getByLabelText("S image grid"));
    expect(imageList.style.gridTemplateColumns).toBe(
      "repeat(3, minmax(0, 1fr))",
    );

    fireEvent.click(screen.getByLabelText("L image grid"));
    expect(imageList.style.gridTemplateColumns).toBe(
      "repeat(1, minmax(0, 1fr))",
    );
  });

  it("selects board objects and searches matches without section actions", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const data = makeData({
      canvases: [
        makeCanvas("board-1", {
          title: "Board 1",
          itemIds: ["alpha", "bravo"],
          positions: {
            alpha: { x: 80, y: 90, width: 160, height: 180 },
            bravo: { x: 340, y: 90, width: 160, height: 180 },
          },
        }),
      ],
    });
    const { container } = renderCanvasView(data);
    setCanvasMeasurements(container);

    const alphaCard = container.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    const bravoCard = container.querySelector(
      '[data-canvas-object-id="bravo"]',
    ) as HTMLElement;
    fireEvent.pointerDown(alphaCard, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerUp(window);
    fireEvent.pointerDown(bravoCard, {
      button: 0,
      clientX: 360,
      clientY: 100,
      metaKey: true,
    });
    fireEvent.pointerUp(window);

    expect(screen.getByText("2 selected")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search board"), {
      target: { value: "Bravo" },
    });
    await waitFor(() => {
      expect(bravoCard.className).toContain("canvas-object-search-match");
    });

    expect(screen.queryByLabelText("Organize into section")).toBeNull();
  });

  it("selects project items and handles selection keyboard shortcuts", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const data = makeData({
      canvases: [
        makeCanvas("board-1", {
          title: "Board 1",
          itemIds: ["alpha", "bravo", "charlie"],
          positions: {
            alpha: { x: 80, y: 90, width: 160, height: 180 },
            bravo: { x: 340, y: 160, width: 160, height: 180 },
            charlie: { x: 610, y: 240, width: 160, height: 180 },
          },
        }),
      ],
    });
    const { container } = renderCanvasView(data);
    setCanvasMeasurements(container);

    for (const itemId of ["alpha", "bravo", "charlie"]) {
      const card = container.querySelector(
        `[data-canvas-object-id="${itemId}"]`,
      ) as HTMLElement;
      fireEvent.pointerDown(card, { button: 0, metaKey: itemId !== "alpha" });
      fireEvent.pointerUp(window);
    }

    expect(screen.getByText("3 selected")).not.toBeNull();

    fireEvent.keyDown(window, { key: "s" });
    fireEvent.keyDown(window, { key: "f" });
    fireEvent.keyDown(window, { key: "0" });
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByText("3 selected")).toBeNull();
    });
  });

  it("duplicates and deletes editable board objects from the selection bar", async () => {
    vi.mocked(window.folio.ensureThumbnails).mockResolvedValue({});
    const data = makeData({
      canvases: [
        makeCanvas("board-1", {
          title: "Board 1",
          itemIds: [],
          notes: [{ id: "note-1", text: "Research note", x: 80, y: 90 }],
          texts: [{ id: "text-1", text: "Heading", x: 300, y: 90 }],
          links: [
            {
              id: "link-1",
              title: "Example",
              url: "https://example.com/",
              capturedAt: "2026-06-17T08:00:00.000Z",
              x: 80,
              y: 280,
            },
          ],
          sections: [
            {
              id: "section-1",
              title: "Frame",
              x: 260,
              y: 240,
              width: 360,
              height: 220,
            },
          ],
        }),
      ],
    });
    const { container } = renderCanvasView(data);
    setCanvasMeasurements(container);

    for (const objectId of ["note-1", "text-1", "link-1", "section-1"]) {
      const element = container.querySelector(
        `[data-canvas-object-id="${objectId}"]`,
      ) as HTMLElement;
      fireEvent.pointerDown(element, { button: 0, metaKey: objectId !== "note-1" });
      fireEvent.pointerUp(window);
    }

    expect(screen.getByText("4 selected")).not.toBeNull();

    fireEvent.click(screen.getByLabelText("Duplicate"));
    await waitFor(() => {
      expect(screen.getByText("4 selected")).not.toBeNull();
    });

    fireEvent.click(screen.getByLabelText("Delete selected"));

    await waitFor(() => {
      expect(screen.queryByText("4 selected")).toBeNull();
    });
    expect(screen.getByDisplayValue("Frame")).not.toBeNull();
  });
});
