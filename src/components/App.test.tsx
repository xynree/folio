import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FolioData, FolioItem, ReconciliationResult } from "../types";
import { ITEM_DRAG_MIME } from "./folio/constants";
import { AppShell } from "./App";
import {
  cloneData,
  emptyReconciliation,
  makeData,
  makeItem,
} from "../test/fixtures";

function setupFolio({
  data = makeData(),
  reconciliation = emptyReconciliation(),
  dialogPaths = [],
  importedItems = [],
}: {
  data?: FolioData;
  reconciliation?: ReconciliationResult;
  dialogPaths?: string[];
  importedItems?: FolioItem[];
} = {}) {
  let currentData = cloneData(data);

  vi.mocked(window.folio.getFolioData).mockImplementation(async () =>
    cloneData(currentData),
  );
  vi.mocked(window.folio.getReconciliationResult).mockResolvedValue(reconciliation);
  vi.mocked(window.folio.saveFolioData).mockImplementation(async (nextData) => {
    currentData = cloneData(nextData);
  });
  vi.mocked(window.folio.openFileDialog).mockResolvedValue(dialogPaths);
  vi.mocked(window.folio.copyToFolio).mockResolvedValue(importedItems);
  vi.mocked(window.folio.copyReference).mockResolvedValue([]);
  vi.mocked(window.folio.deleteItems).mockImplementation(async (itemIds) => {
    currentData = {
      ...currentData,
      items: currentData.items.filter((item) => !itemIds.includes(item.id)),
      canvases: currentData.canvases.map((canvas) => {
        const positions = { ...canvas.positions };
        itemIds.forEach((itemId) => {
          delete positions[itemId];
        });
        return {
          ...canvas,
          itemIds: canvas.itemIds.filter((itemId) => !itemIds.includes(itemId)),
          positions,
          edges: canvas.edges.filter(
            (edge) => !itemIds.includes(edge.fromId) && !itemIds.includes(edge.toId),
          ),
        };
      }),
    };
    return cloneData(currentData);
  });
  vi.mocked(window.folio.ensureThumbnails).mockImplementation(async (itemIds) =>
    Object.fromEntries(
      itemIds.map((itemId) => [itemId, `folio://thumb/${itemId}.jpg`]),
    ),
  );
  vi.mocked(window.folio.getFileDataUrl).mockImplementation(async (filePath) =>
    `data:image/png;base64,${btoa(filePath)}`,
  );
  vi.mocked(window.folio.openInFinder).mockResolvedValue(undefined);
  vi.mocked(window.folio.getPathForFile).mockImplementation((file) => file.name);
  vi.mocked(window.folio.onFilesAdded).mockImplementation(() => () => undefined);

  render(<AppShell />);

  return {
    get data() {
      return currentData;
    },
  };
}

async function waitForArchive() {
  await screen.findByText("Archive");
  await screen.findAllByText("Alpha");
}

function archiveRoute() {
  const route = document.querySelector(".archive-route");
  if (!route) throw new Error("Archive route was not rendered");
  return route as HTMLElement;
}

function itemButton(name: RegExp) {
  const button = screen
    .getAllByRole("button", { name })
    .find((element) => element.classList.contains("item-card-main"));
  if (!button) throw new Error(`Item button ${name.toString()} was not rendered`);
  return button;
}

describe("AppShell Phase 1 and Phase 2 workflows", () => {
  beforeEach(() => {
    vi.mocked(window.confirm).mockReturnValue(true);
  });

  it("loads archive data, thumbnails, status counts, and the docked board panel", async () => {
    setupFolio();

    await waitForArchive();

    expect(screen.getByRole("button", { name: /strip/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /grid/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /import/i })).not.toBeNull();
    expect(screen.getAllByText("3 items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 canvas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 tags").length).toBeGreaterThan(0);
    expect(screen.getByText("Open board")).not.toBeNull();

    await waitFor(() => {
      expect(window.folio.getFileDataUrl).toHaveBeenCalledWith(
        "items/2026/06_june/alpha.png",
      );
    });
  });

  it("imports files from the import button into the archive", async () => {
    setupFolio({
      dialogPaths: ["/tmp/delta.png"],
      importedItems: [
        makeItem("delta", {
          title: "Delta",
          path: "items/2026/06_june/delta.png",
          date: "2026-06-15T11:00:00.000Z",
        }),
      ],
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByRole("button", { name: /import/i }));

    expect(window.folio.openFileDialog).toHaveBeenCalledTimes(1);
    expect(window.folio.copyToFolio).toHaveBeenCalledWith(["/tmp/delta.png"]);
    expect(await screen.findByText("Delta")).not.toBeNull();
    expect(screen.getByText("1 item added to today")).not.toBeNull();
  });

  it("filters grid results with only user-created tags", async () => {
    setupFolio({
      data: makeData({
        items: [
          makeItem("alpha", { title: "Alpha", tagIds: ["tag-sketch"] }),
          makeItem("bravo", { title: "Bravo", tagIds: ["tag-warmup"] }),
          makeItem("charlie", { title: "Charlie" }),
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByRole("button", { name: /grid/i }));

    const filterBar = document.querySelector(".filter-bar");
    expect(filterBar).not.toBeNull();
    expect(within(filterBar as HTMLElement).getByRole("button", { name: /all/i })).not.toBeNull();
    expect(within(filterBar as HTMLElement).getByRole("button", { name: /sketchbook/i })).not.toBeNull();
    expect(within(filterBar as HTMLElement).getByRole("button", { name: /warmup/i })).not.toBeNull();
    expect(within(filterBar as HTMLElement).queryByRole("button", { name: /^sketch$/i })).toBeNull();

    await user.click(within(filterBar as HTMLElement).getByRole("button", { name: /sketchbook/i }));

    expect(within(archiveRoute()).getByText("Alpha")).not.toBeNull();
    expect(within(archiveRoute()).queryByText("Bravo")).toBeNull();
    expect(within(archiveRoute()).queryByText("Charlie")).toBeNull();
  });

  it("supports range multi-select and opening that selection on a new board", async () => {
    const app = setupFolio();

    await waitForArchive();
    await userEvent.click(itemButton(/alpha/i));
    fireEvent.click(itemButton(/charlie/i), {
      shiftKey: true,
    });

    expect(screen.getByText("3 items selected")).not.toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /open on new board/i }));

    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(2);
    });
    expect(app.data.canvases[0].itemIds).toEqual(["alpha", "bravo", "charlie"]);
  });

  it("adds and removes item tags from the More menu submenu", async () => {
    const app = setupFolio({
      data: makeData({
        items: [
          makeItem("alpha", { title: "Alpha", tagIds: ["tag-sketch"] }),
          makeItem("bravo", { title: "Bravo", tagIds: ["tag-warmup"] }),
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for bravo/i));
    await user.click(screen.getByRole("menuitem", { name: /add tags/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /sketchbook/i }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: /warmup/i }));

    await waitFor(() => {
      const bravo = app.data.items.find((item) => item.id === "bravo");
      expect(bravo?.tagIds).toEqual(["tag-sketch"]);
    });
  });

  it("adds tags with Enter in the details modal and removes them with the tag chip", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for alpha/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));

    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    const tagInput = within(dialog).getByPlaceholderText("Tag name");
    await user.type(tagInput, "fresh{Enter}");

    await waitFor(() => {
      const freshTag = app.data.tags.find((tag) => tag.text === "fresh");
      expect(freshTag).toBeTruthy();
      expect(app.data.items.find((item) => item.id === "alpha")?.tagIds).toContain(
        freshTag?.id,
      );
    });

    await user.click(within(dialog).getByRole("button", { name: /fresh/i }));

    await waitFor(() => {
      expect(app.data.tags.some((tag) => tag.text === "fresh")).toBe(false);
      expect(app.data.items.find((item) => item.id === "alpha")?.tagIds).toEqual([]);
    });
  });

  it("opens item details from the More menu and saves metadata changes", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for alpha/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));

    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    const titleInput = within(dialog).getByLabelText("Title");
    await user.clear(titleInput);
    await user.type(titleInput, "Alpha Revised");
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(app.data.items.find((item) => item.id === "alpha")?.title).toBe(
        "Alpha Revised",
      );
    });
  });

  it("runs detail modal Finder and delete actions and clears canvas memberships", async () => {
    const app = setupFolio({
      data: makeData({
        canvases: [
          makeData().canvases[0],
          {
            ...makeData().canvases[0],
            id: "board-2",
            title: "Board 2",
            itemIds: ["alpha", "bravo"],
            positions: {
              alpha: { x: 20, y: 30 },
              bravo: { x: 220, y: 30 },
            },
          },
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for alpha/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));

    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    expect(within(dialog).getByText("Board 1")).not.toBeNull();
    expect(within(dialog).getByText("Board 2")).not.toBeNull();

    await user.click(within(dialog).getByRole("button", { name: /show in finder/i }));
    expect(window.folio.openInFinder).toHaveBeenCalledWith(
      "items/2026/06_june/alpha.png",
    );

    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => {
      expect(app.data.items.some((item) => item.id === "alpha")).toBe(false);
      expect(app.data.canvases.every((canvas) => !canvas.itemIds.includes("alpha"))).toBe(
        true,
      );
      expect(app.data.canvases.every((canvas) => !canvas.positions.alpha)).toBe(true);
    });
  });

  it("adds the current detail item to the active board", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for bravo/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    await user.click(within(dialog).getByRole("button", { name: /add to board/i }));

    await waitFor(() => {
      expect(app.data.canvases[0].itemIds).toEqual(["alpha", "bravo"]);
    });
  });

  it("creates a board when adding an item from details and no board exists", async () => {
    const app = setupFolio({
      data: makeData({ canvases: [] }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for bravo/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    await user.click(within(dialog).getByRole("button", { name: /add to board/i }));

    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(1);
      expect(app.data.canvases[0].itemIds).toEqual(["bravo"]);
    });
  });

  it("toggles selection with command/control clicks and clears with Escape or background click", async () => {
    setupFolio();

    await waitForArchive();
    fireEvent.click(itemButton(/alpha/i), { metaKey: true });
    expect(screen.getByText("1 item selected")).not.toBeNull();

    fireEvent.click(itemButton(/bravo/i), { ctrlKey: true });
    expect(screen.getByText("2 items selected")).not.toBeNull();

    fireEvent.click(itemButton(/alpha/i), { metaKey: true });
    expect(screen.getByText("1 item selected")).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText(/item selected/i)).toBeNull();

    fireEvent.click(itemButton(/charlie/i));
    expect(screen.getByText("1 item selected")).not.toBeNull();
    fireEvent.mouseDown(document.querySelector(".strip-view") as HTMLElement);
    expect(screen.queryByText(/item selected/i)).toBeNull();
  });

  it("closes the details modal with Escape and by clicking outside", async () => {
    const user = userEvent.setup();
    setupFolio();

    await waitForArchive();
    await user.click(screen.getByLabelText(/more actions for alpha/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    expect(await screen.findByRole("dialog", { name: /item details/i })).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /item details/i })).toBeNull();
    });

    await user.click(screen.getByLabelText(/more actions for alpha/i));
    await user.click(screen.getByRole("menuitem", { name: /edit/i }));
    const dialog = await screen.findByRole("dialog", { name: /item details/i });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: /item details/i })).toBeNull();
    });
  });

  it("supports board rename, note creation, board import, and board deletion in the edit menu", async () => {
    const app = setupFolio({
      dialogPaths: ["/tmp/echo.png"],
      importedItems: [
        makeItem("echo", {
          title: "Echo",
          path: "items/2026/06_june/echo.png",
          date: "2026-06-15T11:30:00.000Z",
        }),
      ],
    });
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const boardDialog = await screen.findByRole("dialog", { name: /edit board/i });
    const boardName = within(boardDialog).getByLabelText("Board name");
    await user.clear(boardName);
    await user.type(boardName, "Story Board");
    await user.click(within(boardDialog).getByRole("button", { name: /save name/i }));

    await waitFor(() => {
      expect(app.data.canvases[0].title).toBe("Story Board");
    });

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const reopenedBoardDialog = await screen.findByRole("dialog", {
      name: /edit board/i,
    });

    await user.click(
      within(reopenedBoardDialog).getByRole("button", { name: /add note/i }),
    );
    await waitFor(() => {
      expect(app.data.canvases[0].notes).toHaveLength(1);
    });

    await user.click(
      within(reopenedBoardDialog).getByRole("button", { name: /import to board/i }),
    );
    await waitFor(() => {
      expect(window.folio.copyToFolio).toHaveBeenCalledWith(["/tmp/echo.png"]);
      expect(app.data.items.some((item) => item.id === "echo")).toBe(true);
      expect(app.data.canvases[0].itemIds).toContain("echo");
    });

    await user.click(
      within(reopenedBoardDialog).getByRole("button", { name: /delete board/i }),
    );
    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(0);
    });
  });

  it("creates new empty boards from the dock header", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByRole("button", { name: /new board/i }));

    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(2);
      expect(app.data.canvases[0].itemIds).toEqual([]);
    });
  });

  it("switches boards by clicking the horizontal board list and always shows thumbnail previews", async () => {
    setupFolio({
      data: makeData({
        canvases: [
          {
            ...makeData().canvases[0],
            id: "board-1",
            title: "Board 1",
            itemIds: ["alpha"],
            positions: { alpha: { x: 80, y: 90 } },
          },
          {
            ...makeData().canvases[0],
            id: "board-2",
            title: "Board 2",
            color: "#385d56",
            itemIds: ["bravo", "charlie"],
            positions: {
              bravo: { x: 80, y: 90 },
              charlie: { x: 260, y: 90 },
            },
          },
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    const boardButtons = screen.getAllByRole("button", { name: /board [12]/i });
    expect(boardButtons).toHaveLength(2);
    expect(boardButtons[0].querySelectorAll(".thumb-shell")).toHaveLength(1);
    expect(boardButtons[1].querySelectorAll(".thumb-shell")).toHaveLength(2);

    await user.click(boardButtons[1]);

    await waitFor(() => {
      expect(document.querySelectorAll(".canvas-card")).toHaveLength(2);
    });
    expect(document.querySelector(".canvas-board-copy strong")?.textContent).toBe(
      "Board 2",
    );
  });

  it("drops selected archive items directly onto the canvas", async () => {
    const app = setupFolio();

    await waitForArchive();
    const surface = document.querySelector(".canvas-surface");
    expect(surface).not.toBeNull();

    fireEvent.drop(surface as HTMLElement, {
      clientX: 20120,
      clientY: 20140,
      dataTransfer: {
        getData: (type: string) =>
          type === ITEM_DRAG_MIME ? JSON.stringify(["bravo"]) : "",
        files: [],
      },
    });

    await waitFor(() => {
      expect(app.data.canvases[0].itemIds).toEqual(["alpha", "bravo"]);
      expect(app.data.canvases[0].positions.bravo).toBeTruthy();
    });
  });

  it("zooms the canvas in and out around the current pointer position", async () => {
    setupFolio();

    await waitForArchive();
    const scroll = document.querySelector(".canvas-scroll") as HTMLElement;
    expect(scroll).not.toBeNull();

    scroll.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 50,
        right: 500,
        bottom: 350,
        width: 400,
        height: 300,
        x: 100,
        y: 50,
        toJSON: () => ({}),
      }) as DOMRect;
    scroll.scrollLeft = 1000;
    scroll.scrollTop = 800;

    fireEvent.pointerMove(scroll, { clientX: 250, clientY: 150 });
    fireEvent.wheel(scroll, { deltaY: -120, clientX: 0, clientY: 0 });

    const zoom = Math.exp(120 * 0.0016);
    expect(scroll.scrollLeft).toBeCloseTo((1000 + 150) * zoom - 150, 3);
    expect(scroll.scrollTop).toBeCloseTo((800 + 100) * zoom - 100, 3);

    fireEvent.wheel(scroll, { deltaY: 120, clientX: 0, clientY: 0 });

    expect(scroll.scrollLeft).toBeCloseTo(1000, 3);
    expect(scroll.scrollTop).toBeCloseTo(800, 3);
  });

  it("collapses the tags area and minimizes the board panel", async () => {
    setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByLabelText(/hide tags/i));
    expect(screen.getByLabelText(/show tags/i)).not.toBeNull();

    await user.click(screen.getByLabelText(/minimize board panel/i));
    expect(screen.getAllByLabelText(/open board panel/i).length).toBeGreaterThan(0);
  });
});
