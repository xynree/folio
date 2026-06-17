import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FolioData, FolioItem, ReconciliationResult } from "../types";
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  CANVAS_WORLD_ORIGIN,
  ITEM_DRAG_MIME,
} from "./folio/constants";
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
  vi.mocked(window.folio.importToFolio).mockResolvedValue(importedItems);
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
  vi.mocked(window.folio.ensureReferenceThumbnail).mockImplementation(
    async (referenceId) => `folio://thumb/reference-${referenceId}.jpg`,
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
  await screen.findByRole("button", { name: /strip/i });
  await screen.findAllByText("Alpha");
}

function archiveRoute() {
  const route = document.querySelector(".archive-route");
  if (!route) throw new Error("Archive route was not rendered");
  return route as HTMLElement;
}

async function openBoardPanel(user: ReturnType<typeof userEvent.setup>) {
  const openButton = screen.queryByRole("button", { name: /open board panel/i });
  if (openButton) {
    await user.click(openButton);
  }
  await screen.findByText(/^Boards$/i);
}

async function openBoardBrowser(user: ReturnType<typeof userEvent.setup>) {
  await openBoardPanel(user);
  if (!document.querySelector(".canvas-board-browser")) {
    const boardsButton = screen.queryByRole("button", { name: /^boards$/i });
    if (boardsButton) {
      await user.click(boardsButton);
    }
  }
  await waitFor(() => {
    expect(document.querySelector(".canvas-board-browser")).not.toBeNull();
  });
}

async function openActiveBoardCanvas(user: ReturnType<typeof userEvent.setup>) {
  await openBoardPanel(user);
  if (document.querySelector(".canvas-board-browser")) {
    const boardButton = await waitFor(() => {
      const button = screen
        .getAllByRole("button", { name: /^open /i })
        .find((element) =>
          element.classList.contains("canvas-board-open-button"),
        );
      expect(button).toBeTruthy();
      return button as HTMLElement;
    });
    await user.click(boardButton);
  }
  await screen.findByRole("button", { name: /^boards$/i });
  await waitFor(() => {
    expect(document.querySelector(".canvas-surface")).not.toBeNull();
  });
}

async function showHeatmap(user: ReturnType<typeof userEvent.setup>) {
  const showButton = screen.queryByLabelText(/show heatmap/i);
  if (showButton) {
    await user.click(showButton);
  }
  await screen.findByLabelText("Upload heatmap");
}

function itemButton(name: RegExp) {
  const button = screen
    .getAllByRole("button", { name })
    .find((element) => element.classList.contains("item-card-main"));
  if (!button) throw new Error(`Item button ${name.toString()} was not rendered`);
  return button;
}

function gridTitles() {
  return Array.from(archiveRoute().querySelectorAll(".item-grid .item-title")).map(
    (element) => element.textContent ?? "",
  );
}

function selectedItemTitles() {
  return Array.from(
    archiveRoute().querySelectorAll(".item-card.item-selected .item-title"),
  ).map((element) => element.textContent ?? "");
}

function dispatchWheel(
  target: HTMLElement,
  options: Pick<WheelEventInit, "clientX" | "clientY" | "deltaY">,
) {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
}

describe("AppShell Phase 1 and Phase 2 workflows", () => {
  beforeEach(() => {
    vi.mocked(window.confirm).mockReturnValue(true);
  });

  it("loads archive data, thumbnails, status counts, and the docked board panel", async () => {
    setupFolio();
    const user = userEvent.setup();

    await waitForArchive();

    expect(screen.getByRole("button", { name: /strip/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /grid/i })).not.toBeNull();
    expect(screen.queryByText(/^Strip$/i)).toBeNull();
    expect(screen.queryByText(/^Grid$/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^heatmap$/i })).toBeNull();
    expect(
      document
        .querySelector(".archive-heatmap-footer")
        ?.classList.contains("archive-heatmap-footer-minimized"),
    ).toBe(false);
    expect(screen.queryByText("Heatmap")).toBeNull();
    expect(
      screen.getByLabelText("Upload heatmap").closest(".archive-heatmap-footer"),
    ).not.toBeNull();
    expect(screen.getByLabelText(/minimize heatmap/i)).not.toBeNull();
    expect(screen.getByLabelText(/hide tags/i)).not.toBeNull();
    expect(screen.getByRole("separator", { name: /resize tags panel/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /make archive prominent/i }))
      .not.toBeNull();
    expect(screen.getByRole("button", { name: /make boards prominent/i }))
      .not.toBeNull();
    expect(screen.queryByRole("button", { name: /open archive panel/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /open board panel/i })).toBeNull();
    expect(document.querySelector(".canvas-dock-minimized")).toBeNull();
    expect(document.querySelector(".archive-panel-minimized")).toBeNull();
    expect(document.querySelector(".canvas-board-browser")).not.toBeNull();
    expect(document.querySelector(".canvas-board-grid")).not.toBeNull();
    expect(
      (document.querySelector(".studio-workspace") as HTMLElement).style
        .gridTemplateColumns,
    ).toContain("420px");
    expect(screen.queryByText(/^Board$/)).toBeNull();
    expect(screen.queryByText(/^Open board$/)).toBeNull();

    expect(screen.getByRole("button", { name: /import/i })).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /strip/i }).closest(".archive-floating-actions"),
    ).not.toBeNull();
    expect(
      screen.getByRole("button", { name: /import/i }).closest(".archive-floating-actions"),
    ).not.toBeNull();
    const archiveSizeSlider = screen.getByRole("slider", {
      name: /archive item size/i,
    }) as HTMLInputElement;
    const archiveActions = archiveSizeSlider.closest(".archive-floating-actions");
    expect(archiveActions).not.toBeNull();
    expect(
      archiveRoute().firstElementChild?.classList.contains(
        "archive-titlebar-drag-area",
      ),
    ).toBe(true);
    expect(archiveRoute().contains(archiveActions)).toBe(true);
    expect(archiveActions?.firstElementChild).toBe(
      archiveSizeSlider.closest(".archive-scale-control"),
    );
    expect(archiveSizeSlider.min).toBe("50");
    expect(archiveSizeSlider.max).toBe("200");
    expect(archiveSizeSlider.value).toBe("100");
    fireEvent.change(archiveSizeSlider, { target: { value: "125" } });
    expect(screen.getByText("125%")).not.toBeNull();
    expect(archiveRoute().style.getPropertyValue("--archive-grid-card-min")).toBe(
      "185px",
    );
    expect(archiveRoute().style.getPropertyValue("--archive-item-title-size")).toBe(
      "15.0px",
    );
    expect(archiveRoute().style.getPropertyValue("--archive-day-meta-width")).toBe(
      "",
    );
    expect(screen.queryByText(/^Archive$/)).toBeNull();
    expect(screen.queryByText(/visible item/i)).toBeNull();
    expect(screen.getAllByText("3 items").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 canvas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 tags").length).toBeGreaterThan(0);

    const workspace = document.querySelector(".studio-workspace") as HTMLElement;
    workspace.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 900,
        bottom: 600,
        width: 900,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.pointerDown(screen.getByRole("separator", { name: /resize tags panel/i }), {
      clientX: 176,
    });
    fireEvent.pointerMove(window, { clientX: 260 });
    fireEvent.pointerUp(window, { clientX: 260 });
    await waitFor(() => {
      expect(
        (document.querySelector(".archive-workspace") as HTMLElement).style
          .getPropertyValue("--archive-sidebar-width"),
      ).toBe("260px");
    });

    await user.click(screen.getByRole("button", { name: /make boards prominent/i }));
    expect(document.querySelector(".archive-panel-minimized")).not.toBeNull();
    expect(screen.getByRole("button", { name: /open archive panel/i })).not.toBeNull();
    expect(screen.queryByRole("separator", { name: /resize open board panel/i }))
      .toBeNull();
    expect(workspace.style.gridTemplateColumns).toContain("58px 0px");
    expect(workspace.style.gridTemplateColumns).toContain("minmax(420px, 1fr)");

    await user.click(screen.getByRole("button", { name: /open archive panel/i }));
    expect(document.querySelector(".archive-panel-minimized")).toBeNull();
    expect(document.querySelector(".canvas-dock-minimized")).not.toBeNull();
    expect(screen.getByRole("button", { name: /open board panel/i })).not.toBeNull();
    expect(workspace.style.gridTemplateColumns).toContain("0px 58px");

    await user.click(screen.getByRole("button", { name: /open board panel/i }));
    expect(document.querySelector(".canvas-dock-minimized")).toBeNull();
    expect(screen.getByRole("separator", { name: /resize open board panel/i }))
      .not.toBeNull();

    await user.click(screen.getByLabelText(/minimize heatmap/i));
    expect(
      document
        .querySelector(".archive-heatmap-footer")
        ?.classList.contains("archive-heatmap-footer-minimized"),
    ).toBe(true);
    expect(document.querySelector(".archive-heatmap")).not.toBeNull();
    expect(
      document.querySelector(".archive-heatmap")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(screen.queryByLabelText("Upload heatmap")).toBeNull();
    expect(screen.getByLabelText(/show heatmap/i)).not.toBeNull();

    await user.click(screen.getByLabelText(/show heatmap/i));
    expect(
      document
        .querySelector(".archive-heatmap-footer")
        ?.classList.contains("archive-heatmap-footer-minimized"),
    ).toBe(false);
    expect(screen.getByLabelText("Upload heatmap")).not.toBeNull();

    await waitFor(() => {
      expect(window.folio.ensureThumbnails).toHaveBeenCalledWith(
        expect.arrayContaining(["alpha"]),
      );
    });
    expect(window.folio.getFileDataUrl).not.toHaveBeenCalled();
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

    expect(window.folio.importToFolio).toHaveBeenCalledTimes(1);
    expect(window.folio.openFileDialog).not.toHaveBeenCalled();
    expect(window.folio.copyToFolio).not.toHaveBeenCalled();
    expect(await screen.findByText("Delta")).not.toBeNull();
    expect(screen.getByText("1 item added to today")).not.toBeNull();
  });

  it("falls back to the file dialog if the import bridge is not registered yet", async () => {
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
    vi.mocked(window.folio.importToFolio).mockRejectedValueOnce(
      new Error("No handler registered for 'folio:import-to-folio'"),
    );
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(screen.getByRole("button", { name: /import/i }));

    expect(window.folio.importToFolio).toHaveBeenCalledTimes(1);
    expect(window.folio.openFileDialog).toHaveBeenCalledTimes(1);
    expect(window.folio.copyToFolio).toHaveBeenCalledWith(["/tmp/delta.png"]);
    expect(await screen.findByText("Delta")).not.toBeNull();
  });

  it("sorts grid results by most recent first and hides image type labels", async () => {
    setupFolio({
      data: makeData({
        items: [
          makeItem("alpha", {
            title: "Mango",
            date: "2026-06-15T08:00:00.000Z",
          }),
          makeItem("bravo", {
            title: "Zulu",
            date: "2026-06-15T09:00:00.000Z",
          }),
          makeItem("charlie", {
            title: "Apple",
            date: "2026-06-15T10:00:00.000Z",
          }),
        ],
      }),
    });
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /strip/i });
    await screen.findByText("Mango");
    await user.click(screen.getByRole("button", { name: /grid/i }));

    const sortSelect = screen.getByRole("combobox", {
      name: /sort grid items/i,
    }) as HTMLSelectElement;
    expect(sortSelect.value).toBe("recent");
    expect(gridTitles()).toEqual(["Apple", "Zulu", "Mango"]);
    expect(within(archiveRoute()).queryByText("Sketch · alpha.png")).toBeNull();
    expect(within(archiveRoute()).queryByText("alpha.png")).toBeNull();

    await user.selectOptions(sortSelect, "oldest");
    expect(gridTitles()).toEqual(["Mango", "Zulu", "Apple"]);

    await user.selectOptions(sortSelect, "title");
    expect(gridTitles()).toEqual(["Apple", "Mango", "Zulu"]);
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

  it("does not render empty strip days while filtering by tag", async () => {
    setupFolio({
      data: makeData({
        items: [
          makeItem("untagged-newer", {
            title: "Newer Untagged",
            date: "2026-06-16T10:00:00.000Z",
          }),
          makeItem("tagged-older", {
            title: "Older Tagged",
            date: "2026-06-15T10:00:00.000Z",
            tagIds: ["tag-sketch"],
          }),
        ],
      }),
    });
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /strip/i });
    await screen.findByText("Newer Untagged");
    expect(within(archiveRoute()).getByText("Tue, Jun 16, 2026")).not.toBeNull();
    expect(within(archiveRoute()).getByText("Mon, Jun 15, 2026")).not.toBeNull();

    await user.click(
      within(screen.getByLabelText("Tags")).getByRole("button", {
        name: /^sketchbook1$/i,
      }),
    );

    expect(within(archiveRoute()).queryByText("Tue, Jun 16, 2026")).toBeNull();
    expect(within(archiveRoute()).getByText("Mon, Jun 15, 2026")).not.toBeNull();
    expect(within(archiveRoute()).getByText("Older Tagged")).not.toBeNull();
    expect(within(archiveRoute()).queryByText("Newer Untagged")).toBeNull();
  });

  it("shows persistent upload density in the bottom bar with an 8 upload cap", async () => {
    setupFolio({
      data: makeData({
        items: [
          makeItem("alpha", {
            title: "Alpha",
            date: "2026-06-15T18:00:00.000Z",
          }),
          ...Array.from({ length: 9 }, (_, index) =>
            makeItem(`heavy-${index}`, {
              date: `2026-06-15T18:${String(index).padStart(2, "0")}:00.000Z`,
              title: `Heavy ${index}`,
            }),
          ),
          ...Array.from({ length: 3 }, (_, index) =>
            makeItem(`medium-${index}`, {
              date: `2026-06-14T18:${String(index).padStart(2, "0")}:00.000Z`,
              title: `Medium ${index}`,
            }),
          ),
        ],
      }),
    });
    await waitForArchive();
    const user = userEvent.setup();
    await showHeatmap(user);
    const heatmap = screen.getByLabelText("Upload heatmap");
    expect(
      heatmap.querySelector(".archive-heatmap-months")?.textContent,
    ).toContain("Jun");
    expect(
      heatmap.querySelector(".archive-heatmap-content")?.lastElementChild,
    ).toBe(heatmap.querySelector(".archive-heatmap-legend"));

    const heavyDay = heatmap.querySelector(
      '[data-date="2026-06-15"]',
    ) as HTMLElement;
    const mediumDay = heatmap.querySelector(
      '[data-date="2026-06-14"]',
    ) as HTMLElement;

    expect(heavyDay.dataset.count).toBe("10");
    expect(heavyDay.dataset.level).toBe("8");
    expect(mediumDay.dataset.count).toBe("3");
    expect(mediumDay.dataset.level).toBe("3");

    const scroller = heatmap.querySelector(
      ".archive-heatmap-scroll",
    ) as HTMLElement;
    Object.defineProperty(scroller, "scrollWidth", {
      configurable: true,
      value: 1200,
    });
    Object.defineProperty(scroller, "clientWidth", {
      configurable: true,
      value: 320,
    });

    fireEvent.wheel(scroller, { deltaY: 96 });
    expect(scroller.scrollLeft).toBe(96);
  });

  it("supports range multi-select and opening that selection on a new board", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(itemButton(/alpha/i));
    fireEvent.click(itemButton(/charlie/i), {
      shiftKey: true,
    });

    expect(screen.getByText("3 items selected")).not.toBeNull();
    expect(screen.queryByText("Drag onto a board")).toBeNull();
    const selectionPopup = screen
      .getByText("3 items selected")
      .closest(".selection-bar");
    expect(selectionPopup).not.toBeNull();
    expect(selectionPopup?.classList.contains("selection-bar-archive-top")).toBe(
      true,
    );
    expect(archiveRoute().contains(selectionPopup)).toBe(true);
    expect(selectionPopup?.parentElement?.classList.contains("app-shell")).toBe(
      false,
    );
    expect(
      screen.queryByRole("button", { name: /add to active board/i }),
    ).toBeNull();
    expect(screen.queryByText("+2")).toBeNull();
    expect(
      within(selectionPopup as HTMLElement).getByRole("button", {
        name: /^clear$/i,
      }).classList.contains("selection-clear-button"),
    ).toBe(true);
    await user.click(
      within(selectionPopup as HTMLElement).getByRole("button", {
        name: /new board/i,
      }),
    );
    const newBoardDialog = await screen.findByRole("dialog", {
      name: /name new board/i,
    });
    await user.type(within(newBoardDialog).getByLabelText("Board name"), "Story");
    await user.click(within(newBoardDialog).getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(2);
    });
    expect(app.data.canvases[0].title).toBe("Story");
    expect(app.data.canvases[0].itemIds).toEqual(["alpha", "bravo", "charlie"]);
    expect(screen.queryByRole("dialog", { name: /name new board/i })).toBeNull();
    expect(screen.getByText(/Created/).textContent).toContain("Last saved");
    expect(screen.queryByText("3 items · 0 notes · 0 references")).toBeNull();

    await waitFor(() => {
      expect(document.querySelectorAll(".canvas-card")).toHaveLength(3);
    });
    const canvasScroll = document.querySelector(".canvas-scroll") as HTMLElement;
    await waitFor(() => {
      expect(canvasScroll.scrollLeft).toBe(CANVAS_WORLD_ORIGIN - 80);
      expect(canvasScroll.scrollTop).toBe(CANVAS_WORLD_ORIGIN - 80);
    });
  });

  it("tags selected items from the selection action bar", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(itemButton(/alpha/i));
    fireEvent.click(itemButton(/charlie/i), {
      shiftKey: true,
    });

    const selectionPopup = screen
      .getByText("3 items selected")
      .closest(".selection-bar") as HTMLElement;
    await user.click(
      within(selectionPopup).getByRole("button", {
        name: /^tag$/i,
      }),
    );
    const tagDialog = await screen.findByRole("dialog", {
      name: /tag selected items/i,
    });
    await user.type(within(tagDialog).getByLabelText("Tag name"), "research");
    await user.click(within(tagDialog).getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      const tag = app.data.tags.find((candidate) => candidate.text === "research");
      expect(tag).toBeTruthy();
      expect(
        app.data.items
          .filter((item) => ["alpha", "bravo", "charlie"].includes(item.id))
          .every((item) => item.tagIds.includes(tag?.id ?? "")),
      ).toBe(true);
    });
    expect(screen.queryByRole("dialog", { name: /tag selected items/i })).toBeNull();
    expect(screen.getByText("3 items selected")).not.toBeNull();
  });

  it("bulk deletes selected items from the selection action bar", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await user.click(itemButton(/alpha/i));
    fireEvent.click(itemButton(/charlie/i), {
      shiftKey: true,
    });

    const selectionPopup = screen
      .getByText("3 items selected")
      .closest(".selection-bar") as HTMLElement;
    await user.click(
      within(selectionPopup).getByRole("button", {
        name: /^delete$/i,
      }),
    );

    await waitFor(() => {
      expect(window.folio.deleteItems).toHaveBeenCalledWith([
        "alpha",
        "bravo",
        "charlie",
      ]);
      expect(app.data.items).toHaveLength(0);
      expect(app.data.canvases[0].itemIds).toEqual([]);
    });
    expect(screen.queryByText("3 items selected")).toBeNull();
  });

  it("range selects across strip day sections in visual order", async () => {
    setupFolio({
      data: makeData({
        items: [
          makeItem("older-a", {
            title: "Older A",
            date: "2026-06-15T08:00:00.000Z",
          }),
          makeItem("older-b", {
            title: "Older B",
            date: "2026-06-15T09:00:00.000Z",
          }),
          makeItem("older-c", {
            title: "Older C",
            date: "2026-06-15T10:00:00.000Z",
          }),
          makeItem("newer-a", {
            title: "Newer A",
            date: "2026-06-16T08:00:00.000Z",
          }),
          makeItem("newer-b", {
            title: "Newer B",
            date: "2026-06-16T09:00:00.000Z",
          }),
          makeItem("newer-c", {
            title: "Newer C",
            date: "2026-06-16T10:00:00.000Z",
          }),
        ],
      }),
    });

    await screen.findByRole("button", { name: /strip/i });
    await screen.findByText("Newer B");
    await userEvent.click(itemButton(/newer b/i));
    fireEvent.click(itemButton(/older b/i), {
      shiftKey: true,
    });

    expect(screen.getByText("4 items selected")).not.toBeNull();
    expect(new Set(selectedItemTitles())).toEqual(
      new Set(["Newer B", "Newer C", "Older A", "Older B"]),
    );
    expect(selectedItemTitles()).not.toContain("Newer A");
    expect(selectedItemTitles()).not.toContain("Older C");
  });

  it("adds and removes item tags from the More menu hover submenu", async () => {
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
    await user.hover(screen.getByRole("menuitem", { name: /add tags/i }));
    const tagSubmenu = screen.getByRole("menu", {
      name: /add or remove tags/i,
    });
    expect(tagSubmenu.closest(".item-submenu")).not.toBeNull();
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

  it("supports board rename, quick note creation, quick board import, and board deletion", async () => {
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
    await openActiveBoardCanvas(user);
    expect(
      screen.getByRole("button", { name: /add note/i }).closest(".canvas-board-actions"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("button", { name: /import images/i })
        .closest(".canvas-board-actions"),
    ).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /edit/i }));

    const boardDialog = await screen.findByRole("dialog", { name: /edit board/i });
    const closeButton = within(boardDialog).getByLabelText(/close board tools/i);
    const actionBar = within(boardDialog).getByRole("toolbar", {
      name: /board actions/i,
    });
    expect(closeButton.closest(".board-edit-popover-header")).not.toBeNull();
    expect(
      within(actionBar).getByRole("button", { name: /save board/i }),
    ).not.toBeNull();
    expect(within(actionBar).queryByRole("button", { name: /add note/i })).toBeNull();
    expect(
      within(actionBar).queryByRole("button", {
        name: /import images/i,
      }),
    ).toBeNull();
    expect(
      within(actionBar).getByRole("button", {
        name: /delete board/i,
      }),
    ).not.toBeNull();

    const boardName = within(boardDialog).getByLabelText("Board name");
    const boardColor = within(boardDialog).getByLabelText(
      "Board color",
    ) as HTMLInputElement;
    await user.clear(boardName);
    await user.type(boardName, "Story Board");
    fireEvent.change(boardColor, { target: { value: "#546f9a" } });
    await user.click(within(boardDialog).getByRole("button", { name: /save board/i }));

    await waitFor(() => {
      expect(app.data.canvases[0].title).toBe("Story Board");
      expect(app.data.canvases[0].color).toBe("#546f9a");
    });

    const currentCloseButton = screen.queryByLabelText(/close board tools/i);
    if (currentCloseButton) {
      await user.click(currentCloseButton);
    }

    await user.click(screen.getByRole("button", { name: /add note/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].notes).toHaveLength(1);
    });

    const noteTextarea = document.querySelector(".canvas-note textarea") as HTMLElement;
    expect(noteTextarea).not.toBeNull();
    fireEvent.pointerDown(noteTextarea, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 230 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 230 });

    await waitFor(() => {
      expect(app.data.canvases[0].notes[0]).toMatchObject({
        x: 200,
        y: 150,
      });
    });

    await user.click(screen.getByRole("button", { name: /import images/i }));
    await waitFor(() => {
      expect(window.folio.importToFolio).toHaveBeenCalledTimes(1);
      expect(app.data.items.some((item) => item.id === "echo")).toBe(true);
      expect(app.data.canvases[0].itemIds).toContain("echo");
    });

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const reopenedBoardDialog = await screen.findByRole("dialog", {
      name: /edit board/i,
    });
    await user.click(
      within(reopenedBoardDialog).getByRole("button", { name: /delete board/i }),
    );
    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(0);
    });
  });

  it("creates new empty boards from the board grid", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openBoardBrowser(user);
    expect(screen.getByRole("button", { name: /new board/i })).not.toBeNull();
    await user.click(screen.getByRole("button", { name: /new board/i }));

    await waitFor(() => {
      expect(app.data.canvases).toHaveLength(2);
      expect(app.data.canvases[0].itemIds).toEqual([]);
    });
  });

  it("switches boards from the board grid and always shows thumbnail previews", async () => {
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
    await openBoardBrowser(user);
    const boardButtons = screen.getAllByRole("button", {
      name: /^open board [12],/i,
    });
    expect(boardButtons).toHaveLength(2);
    expect(boardButtons[0].classList.contains("canvas-board-open-button")).toBe(
      true,
    );
    expect(boardButtons[0].closest(".canvas-board-tile")).not.toBeNull();
    expect(boardButtons[0].querySelector(".canvas-board-cover")).toBe(
      boardButtons[0].firstElementChild,
    );
    expect(
      boardButtons[0]
        .querySelector(".canvas-board-cover")
        ?.classList.contains("canvas-board-cover-1"),
    ).toBe(true);
    expect(
      boardButtons[1]
        .querySelector(".canvas-board-cover")
        ?.classList.contains("canvas-board-cover-2"),
    ).toBe(true);
    expect(boardButtons[1].querySelectorAll(".canvas-board-cover-slot")).toHaveLength(
      2,
    );
    expect(boardButtons[0].querySelectorAll(".thumb-shell")).toHaveLength(1);
    expect(boardButtons[1].querySelectorAll(".thumb-shell")).toHaveLength(2);
    expect(
      boardButtons[1].querySelector(".canvas-board-tile-meta strong")?.textContent,
    ).toBe("Board 2");

    await user.click(boardButtons[1]);

    await waitFor(() => {
      expect(document.querySelectorAll(".canvas-card")).toHaveLength(2);
    });
    expect(document.querySelector(".canvas-board-copy strong")?.textContent).toBe(
      "Board 2",
    );
  });

  it("focuses the current board when reopening it from the board browser", async () => {
    setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openBoardBrowser(user);
    await user.click(screen.getByRole("button", { name: /^open board 1,/i }));

    const canvasScroll = await waitFor(() => {
      const scroll = document.querySelector(".canvas-scroll") as HTMLElement | null;
      expect(scroll).not.toBeNull();
      return scroll as HTMLElement;
    });
    await waitFor(() => {
      expect(canvasScroll.scrollLeft).toBe(CANVAS_WORLD_ORIGIN - 80);
      expect(canvasScroll.scrollTop).toBe(CANVAS_WORLD_ORIGIN - 80);
    });
    expect(document.querySelector(".canvas-board-copy strong")?.textContent).toBe(
      "Board 1",
    );
  });

  it("opens board edit and delete actions from the board grid menu", async () => {
    const app = setupFolio({
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
            itemIds: ["bravo"],
            positions: { bravo: { x: 80, y: 90 } },
          },
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await openBoardBrowser(user);

    await user.click(
      screen.getByRole("button", { name: /more actions for board 2/i }),
    );
    const board2Menu = screen.getByRole("menu", {
      name: /actions for board 2/i,
    });
    expect(within(board2Menu).getByRole("menuitem", { name: /edit/i })).not.toBeNull();
    expect(
      within(board2Menu).getByRole("menuitem", { name: /delete/i }),
    ).not.toBeNull();

    await user.click(within(board2Menu).getByRole("menuitem", { name: /edit/i }));
    const boardDialog = await screen.findByRole("dialog", { name: /edit board/i });
    expect(document.querySelector(".canvas-board-browser")).not.toBeNull();
    expect(document.querySelector(".canvas-board-copy")).toBeNull();
    expect(boardDialog.classList.contains("board-edit-browser-dialog")).toBe(true);

    const boardName = within(boardDialog).getByLabelText("Board name");
    await user.clear(boardName);
    await user.type(boardName, "Board Two");
    await user.click(within(boardDialog).getByRole("button", { name: /save board/i }));
    await waitFor(() => {
      expect(app.data.canvases[1].title).toBe("Board Two");
    });
    expect(
      screen.getByRole("button", { name: /^open board two,/i }),
    ).not.toBeNull();

    await user.click(within(boardDialog).getByLabelText(/close board tools/i));
    await user.click(
      screen.getByRole("button", { name: /more actions for board 1/i }),
    );
    const board1Menu = screen.getByRole("menu", {
      name: /actions for board 1/i,
    });
    await user.click(within(board1Menu).getByRole("menuitem", { name: /delete/i }));

    await waitFor(() => {
      expect(app.data.canvases.map((canvas) => canvas.id)).toEqual(["board-2"]);
    });
  });

  it("drops archive cards onto board grid tiles without opening the board", async () => {
    const app = setupFolio({
      data: makeData({
        canvases: [
          {
            ...makeData().canvases[0],
            id: "board-1",
            title: "Board 1",
            itemIds: [],
            positions: {},
          },
          {
            ...makeData().canvases[0],
            id: "board-2",
            title: "Board 2",
            color: "#385d56",
            itemIds: [],
            positions: {},
          },
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await openBoardBrowser(user);

    const board2Tile = screen
      .getByRole("button", { name: /^open board 2,/i })
      .closest(".canvas-board-tile") as HTMLElement;
    expect(board2Tile).not.toBeNull();

    const dataTransfer = {
      dropEffect: "move",
      types: [ITEM_DRAG_MIME],
      getData: (type: string) =>
        type === ITEM_DRAG_MIME ? JSON.stringify(["alpha"]) : "",
    };

    fireEvent.dragOver(board2Tile, { dataTransfer });
    expect(board2Tile.classList.contains("canvas-board-tile-drop-target")).toBe(
      true,
    );
    fireEvent.drop(board2Tile, { dataTransfer });

    await waitFor(() => {
      expect(app.data.canvases[1].itemIds).toEqual(["alpha"]);
    });
    expect(document.querySelector(".canvas-board-browser")).not.toBeNull();
    expect(document.querySelector(".canvas-board-copy")).toBeNull();
    expect(
      screen.getByRole("button", { name: /^open board 2, 1 item/i }),
    ).not.toBeNull();
  });

  it("drops selected archive items directly onto the canvas", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
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

  it("drops external image references onto the canvas with thumbnail previews", async () => {
    const app = setupFolio();
    vi.mocked(window.folio.getPathForFile).mockReturnValue("/tmp/reference.png");
    vi.mocked(window.folio.copyReference).mockResolvedValueOnce([
      {
        id: "ref-1",
        filename: "reference.png",
        path: "references/board-1/reference.png",
        x: 0,
        y: 0,
      },
    ]);
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    const surface = document.querySelector(".canvas-surface");
    expect(surface).not.toBeNull();

    fireEvent.drop(surface as HTMLElement, {
      clientX: 20120,
      clientY: 20140,
      dataTransfer: {
        getData: () => "",
        files: [new File(["reference"], "reference.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(app.data.canvases[0].references).toHaveLength(1);
    });
    await waitFor(() => {
      expect(window.folio.ensureReferenceThumbnail).toHaveBeenCalledWith(
        "ref-1",
        "references/board-1/reference.png",
      );
    });
    const thumbnail = await waitFor(() => {
      const image = document.querySelector(
        '[data-canvas-object-id="ref-1"] .thumb-shell img',
      ) as HTMLImageElement | null;
      expect(image).not.toBeNull();
      return image as HTMLImageElement;
    });
    expect(thumbnail.getAttribute("src")).toBe(
      "folio://thumb/reference-ref-1.jpg",
    );
    expect(window.folio.getFileDataUrl).not.toHaveBeenCalledWith(
      "references/board-1/reference.png",
    );
  });

  it("imports reference images from the focused board toolbar", async () => {
    const app = setupFolio({
      dialogPaths: ["/tmp/reference-a.png", "/tmp/reference-b.png"],
    });
    vi.mocked(window.folio.copyReference).mockResolvedValueOnce([
      {
        id: "ref-a",
        filename: "reference-a.png",
        path: "references/board-1/reference-a.png",
        x: 0,
        y: 0,
      },
      {
        id: "ref-b",
        filename: "reference-b.png",
        path: "references/board-1/reference-b.png",
        x: 0,
        y: 0,
      },
    ]);
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    await new Promise((resolve) => {
      window.setTimeout(resolve, 320);
    });
    const scroll = document.querySelector(".canvas-scroll") as HTMLElement;
    Object.defineProperties(scroll, {
      clientHeight: { configurable: true, value: 300 },
      clientWidth: { configurable: true, value: 400 },
    });
    scroll.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    scroll.scrollLeft = CANVAS_WORLD_ORIGIN - 40;
    scroll.scrollTop = CANVAS_WORLD_ORIGIN - 20;

    await user.click(screen.getByRole("button", { name: /add reference/i }));

    await waitFor(() => {
      expect(window.folio.openFileDialog).toHaveBeenCalledTimes(1);
      expect(window.folio.copyReference).toHaveBeenCalledWith("board-1", [
        "/tmp/reference-a.png",
        "/tmp/reference-b.png",
      ]);
      expect(app.data.canvases[0].references).toHaveLength(2);
    });
    expect(app.data.canvases[0].references[0]).toMatchObject({
      id: "ref-a",
      x: 160,
      y: 130,
    });
    expect(app.data.canvases[0].references[1]).toMatchObject({
      id: "ref-b",
      x: 188,
      y: 158,
    });
  });

  it("draws, labels, and deletes edges between canvas objects", async () => {
    const app = setupFolio({
      data: makeData({
        canvases: [
          makeData().canvases[0],
        ].map((canvas) => ({
          ...canvas,
          itemIds: ["alpha", "bravo"],
          positions: {
            alpha: { x: 80, y: 90 },
            bravo: { x: 320, y: 120 },
          },
        })),
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    const alphaCard = document.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    const bravoCard = document.querySelector(
      '[data-canvas-object-id="bravo"]',
    ) as HTMLElement;
    expect(alphaCard).not.toBeNull();
    expect(bravoCard).not.toBeNull();

    const alphaRightConnector = within(alphaCard).getByRole("button", {
      name: /connect alpha from right/i,
    });
    const bravoLeftConnector = within(bravoCard).getByRole("button", {
      name: /connect bravo from left/i,
    });

    fireEvent.pointerDown(alphaRightConnector, {
      button: 0,
      clientX: 242,
      clientY: 185,
    });
    fireEvent.pointerMove(window, { clientX: 320, clientY: 140 });
    fireEvent.pointerUp(bravoLeftConnector, { clientX: 320, clientY: 140 });

    await waitFor(() => {
      expect(app.data.canvases[0].edges).toHaveLength(1);
    });
    expect(app.data.canvases[0].edges[0]).toMatchObject({
      fromId: "alpha",
      toId: "bravo",
      fromSide: "right",
      toSide: "left",
      direction: "forward",
    });
    const edgePath = document.querySelector(
      ".canvas-edge .canvas-edge-path",
    ) as SVGPathElement | null;
    expect(edgePath).not.toBeNull();
    expect(edgePath?.getAttribute("marker-end")).toBe("url(#canvas-edge-arrow)");

    await user.click(screen.getByRole("button", { name: /bidirectional/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].edges[0].direction).toBe("bidirectional");
    });
    expect(
      (document.querySelector(".canvas-edge .canvas-edge-path") as SVGPathElement)
        .getAttribute("marker-start"),
    ).toBe("url(#canvas-edge-arrow)");

    await user.click(screen.getByRole("button", { name: /no direction/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].edges[0].direction).toBe("none");
    });
    const undirectedPath = document.querySelector(
      ".canvas-edge .canvas-edge-path",
    ) as SVGPathElement;
    expect(undirectedPath.getAttribute("marker-start")).toBeNull();
    expect(undirectedPath.getAttribute("marker-end")).toBeNull();

    await user.click(screen.getByRole("button", { name: /single direction/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].edges[0].direction).toBe("forward");
    });

    await user.click(screen.getByRole("button", { name: /reverse direction/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].edges[0]).toMatchObject({
        fromId: "bravo",
        toId: "alpha",
        fromSide: "left",
        toSide: "right",
        direction: "forward",
      });
    });

    const edgeLabelButton = await screen.findByRole("button", {
      name: /edge label: link/i,
    });
    fireEvent.doubleClick(edgeLabelButton);
    const labelInput = await screen.findByLabelText(/edge label/i);
    await user.type(labelInput, "Inspired by{Enter}");

    await waitFor(() => {
      expect(app.data.canvases[0].edges[0].label).toBe("Inspired by");
    });
    const updatedLabel = await screen.findByRole("button", {
      name: /edge label: inspired by/i,
    });
    await user.click(updatedLabel);
    await user.click(screen.getByRole("button", { name: /remove link/i }));

    await waitFor(() => {
      expect(app.data.canvases[0].edges).toHaveLength(0);
    });
  });

  it("connects item, reference, note, and text objects through side nodes", async () => {
    const app = setupFolio({
      data: makeData({
        canvases: [
          {
            ...makeData().canvases[0],
            itemIds: ["alpha"],
            positions: { alpha: { x: 80, y: 90 } },
            references: [
              {
                id: "ref-a",
                filename: "swatch.png",
                path: "references/board-1/swatch.png",
                x: 320,
                y: 90,
              },
            ],
            notes: [
              {
                id: "note-a",
                text: "Check this",
                x: 80,
                y: 340,
              },
            ],
            texts: [
              {
                id: "text-a",
                text: "Direction",
                x: 340,
                y: 360,
              },
            ],
          },
        ],
      }),
    });
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);

    const alphaCard = document.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    const referenceCard = document.querySelector(
      '[data-canvas-object-id="ref-a"]',
    ) as HTMLElement;
    const noteCard = document.querySelector(
      '[data-canvas-object-id="note-a"]',
    ) as HTMLElement;
    const textCard = document.querySelector(
      '[data-canvas-object-id="text-a"]',
    ) as HTMLElement;

    fireEvent.pointerDown(
      within(alphaCard).getByRole("button", {
        name: /connect alpha from right/i,
      }),
      { button: 0, clientX: 242, clientY: 185 },
    );
    fireEvent.pointerMove(window, { clientX: 320, clientY: 185 });
    fireEvent.pointerUp(
      within(referenceCard).getByRole("button", {
        name: /connect swatch\.png from left/i,
      }),
      { clientX: 320, clientY: 185 },
    );

    fireEvent.pointerDown(
      within(noteCard).getByRole("button", {
        name: /connect note from right/i,
      }),
      { button: 0, clientX: 300, clientY: 415 },
    );
    fireEvent.pointerMove(window, { clientX: 340, clientY: 408 });
    fireEvent.pointerUp(
      within(textCard).getByRole("button", {
        name: /connect text from left/i,
      }),
      { clientX: 340, clientY: 408 },
    );

    await waitFor(() => {
      expect(app.data.canvases[0].edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fromId: "alpha",
            toId: "ref-a",
            fromSide: "right",
            toSide: "left",
          }),
          expect.objectContaining({
            fromId: "note-a",
            toId: "text-a",
            fromSide: "right",
            toSide: "left",
          }),
        ]),
      );
    });
  });

  it("adds, edits, and deletes board text with the text tool", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    const surface = document.querySelector(".canvas-surface") as HTMLElement;
    expect(surface).not.toBeNull();
    surface.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: CANVAS_WORLD_ORIGIN * 2,
        bottom: CANVAS_WORLD_ORIGIN * 2,
        width: CANVAS_WORLD_ORIGIN * 2,
        height: CANVAS_WORLD_ORIGIN * 2,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await user.click(screen.getByRole("button", { name: /text tool/i }));
    fireEvent.pointerDown(surface, { button: 0, clientX: 20160, clientY: 20180 });

    await waitFor(() => {
      expect(app.data.canvases[0].texts).toHaveLength(1);
    });
    expect(app.data.canvases[0].texts?.[0]).toMatchObject({
      size: "md",
      text: "Text",
      x: 160,
      y: 180,
    });

    const textArea = await screen.findByLabelText(/board text/i);
    await user.clear(textArea);
    await user.type(textArea, "Open question");

    await waitFor(() => {
      expect(app.data.canvases[0].texts?.[0].text).toBe("Open question");
    });

    await user.click(screen.getByRole("button", { name: /large text/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].texts?.[0].size).toBe("large");
    });

    await user.click(screen.getByRole("button", { name: /delete text/i }));
    await waitFor(() => {
      expect(app.data.canvases[0].texts).toHaveLength(0);
    });
  });

  it("draws freehand strokes with tool cursors and supports circle erasing", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    const surface = document.querySelector(".canvas-surface") as HTMLElement;
    expect(surface).not.toBeNull();
    surface.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: CANVAS_WORLD_ORIGIN * 2,
        bottom: CANVAS_WORLD_ORIGIN * 2,
        width: CANVAS_WORLD_ORIGIN * 2,
        height: CANVAS_WORLD_ORIGIN * 2,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    await user.click(screen.getByRole("button", { name: /pen tool/i }));
    fireEvent.pointerMove(surface, { clientX: 20100, clientY: 20110 });
    await waitFor(() => {
      expect(document.querySelector(".canvas-tool-cursor-pen")).not.toBeNull();
    });
    fireEvent.pointerDown(surface, { button: 0, clientX: 20110, clientY: 20120 });
    fireEvent.pointerMove(window, { clientX: 20130, clientY: 20144 });
    fireEvent.pointerMove(window, { clientX: 20160, clientY: 20170 });
    fireEvent.pointerUp(window, { clientX: 20160, clientY: 20170 });

    await waitFor(() => {
      expect(app.data.canvases[0].strokes).toHaveLength(1);
      expect(app.data.canvases[0].strokes?.[0].path).toContain("M 20110 20120");
    });
    const firstStrokePath = document.querySelector(".canvas-stroke-path");
    expect(firstStrokePath).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /eraser tool/i }));
    fireEvent.pointerMove(surface, { clientX: 20110, clientY: 20104 });
    await waitFor(() => {
      expect(document.querySelector(".canvas-tool-cursor-eraser")).not.toBeNull();
      expect(document.querySelector(".canvas-eraser-radius")).not.toBeNull();
    });
    fireEvent.pointerDown(surface, { button: 0, clientX: 20060, clientY: 20120 });
    fireEvent.pointerMove(window, { clientX: 20110, clientY: 20104 });
    fireEvent.pointerUp(window, { clientX: 20110, clientY: 20104 });

    await waitFor(() => {
      expect(app.data.canvases[0].strokes).toHaveLength(1);
    });
    expect(app.data.canvases[0].strokes?.[0].path).not.toContain(
      "M 20110 20120",
    );
    expect(app.data.canvases[0].strokes?.[0].path).toContain("L 20160 20170");

    await user.click(screen.getByRole("button", { name: /pen tool/i }));
    fireEvent.pointerDown(surface, { button: 0, clientX: 20110, clientY: 20120 });
    fireEvent.pointerMove(window, { clientX: 20130, clientY: 20144 });
    fireEvent.pointerMove(window, { clientX: 20160, clientY: 20170 });
    fireEvent.pointerUp(window, { clientX: 20160, clientY: 20170 });

    await waitFor(() => {
      expect(app.data.canvases[0].strokes).toHaveLength(2);
    });

    fireEvent.keyDown(window, { key: "z", metaKey: true });
    await waitFor(() => {
      expect(app.data.canvases[0].strokes).toHaveLength(1);
    });
  });

  it("drags canvas cards from their image content without turning drags into clicks", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    const image = await waitFor(() => {
      const thumbnail = document.querySelector(
        ".canvas-card .thumb-shell img",
      ) as HTMLElement | null;
      expect(thumbnail).not.toBeNull();
      return thumbnail as HTMLElement;
    });

    fireEvent.pointerDown(image, { clientX: 200, clientY: 200 });
    fireEvent.pointerMove(window, { clientX: 260, clientY: 230 });
    fireEvent.pointerUp(window, { clientX: 260, clientY: 230 });
    fireEvent.click(image);

    await waitFor(() => {
      expect(app.data.canvases[0].positions.alpha).toEqual({ x: 140, y: 120 });
    });
    expect(screen.queryByRole("dialog", { name: /item details/i })).toBeNull();

    const movedImage = document.querySelector(
      ".canvas-card .thumb-shell img",
    ) as HTMLElement;
    fireEvent.click(movedImage);

    expect(await screen.findByRole("dialog", { name: /item details/i })).not.toBeNull();
  });

  it("resizes canvas cards and preserves image card proportions", async () => {
    const app = setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);

    const alphaCard = document.querySelector(
      '[data-canvas-object-id="alpha"]',
    ) as HTMLElement;
    expect(alphaCard).not.toBeNull();
    expect(alphaCard.style.width).toBe("162px");
    expect(alphaCard.style.height).toBe("190px");

    const resizeCorner = alphaCard.querySelector(
      ".canvas-card-resize-corner",
    ) as HTMLElement;
    expect(resizeCorner).not.toBeNull();
    fireEvent.pointerDown(resizeCorner, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(window, { clientX: 262, clientY: 100 });

    await waitFor(() => {
      expect(alphaCard.style.width).toBe("324px");
      expect(alphaCard.style.height).toBe("380px");
    });

    fireEvent.pointerUp(window, { clientX: 262, clientY: 100 });

    await waitFor(() => {
      expect(app.data.canvases[0].positions.alpha).toMatchObject({
        x: 80,
        y: 90,
        width: 324,
        height: 380,
      });
    });
  });

  it("zooms the canvas in and out around the current pointer position", async () => {
    setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    await openActiveBoardCanvas(user);
    expect(document.querySelector(".canvas-backing")).toBeInstanceOf(
      HTMLCanvasElement,
    );

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
    const zoomInEvent = dispatchWheel(scroll, {
      deltaY: -120,
      clientX: 0,
      clientY: 0,
    });

    const zoom = Math.exp(120 * 0.0016);
    expect(zoomInEvent.defaultPrevented).toBe(true);
    expect(scroll.scrollLeft).toBeCloseTo((1000 + 150) * zoom - 150, 3);
    expect(scroll.scrollTop).toBeCloseTo((800 + 100) * zoom - 100, 3);

    dispatchWheel(scroll, { deltaY: 120, clientX: 0, clientY: 0 });

    expect(scroll.scrollLeft).toBeCloseTo(1000, 3);
    expect(scroll.scrollTop).toBeCloseTo(800, 3);

    Array.from({ length: 20 }).forEach(() => {
      dispatchWheel(scroll, { deltaY: -120, clientX: 250, clientY: 150 });
    });

    const maxZoomLeft = scroll.scrollLeft;
    const maxZoomTop = scroll.scrollTop;
    const blockedZoomInEvent = dispatchWheel(scroll, {
      deltaY: -120,
      clientX: 250,
      clientY: 150,
    });

    expect(blockedZoomInEvent.defaultPrevented).toBe(true);
    expect((document.querySelector(".canvas-surface") as HTMLElement).style.transform)
      .toBe(`scale(${CANVAS_MAX_ZOOM})`);
    expect(scroll.scrollLeft).toBeCloseTo(maxZoomLeft, 3);
    expect(scroll.scrollTop).toBeCloseTo(maxZoomTop, 3);

    Array.from({ length: 30 }).forEach(() => {
      dispatchWheel(scroll, { deltaY: 120, clientX: 250, clientY: 150 });
    });

    const minZoomLeft = scroll.scrollLeft;
    const minZoomTop = scroll.scrollTop;
    const blockedZoomOutEvent = dispatchWheel(scroll, {
      deltaY: 120,
      clientX: 250,
      clientY: 150,
    });

    expect(blockedZoomOutEvent.defaultPrevented).toBe(true);
    expect((document.querySelector(".canvas-surface") as HTMLElement).style.transform)
      .toBe(`scale(${CANVAS_MIN_ZOOM})`);
    expect(scroll.scrollLeft).toBeCloseTo(minZoomLeft, 3);
    expect(scroll.scrollTop).toBeCloseTo(minZoomTop, 3);
  });

  it("collapses the tags area and minimizes the board panel", async () => {
    setupFolio();
    const user = userEvent.setup();

    await waitForArchive();
    expect(screen.getByLabelText(/hide tags/i)).not.toBeNull();
    expect(
      screen
        .getByLabelText("Tags")
        .firstElementChild?.classList.contains("tags-sidebar-window-controls"),
    ).toBe(true);
    expect(screen.queryByRole("button", { name: /open board panel/i })).toBeNull();
    expect(document.querySelector(".canvas-board-browser")).not.toBeNull();
    expect(screen.getByLabelText(/minimize heatmap/i)).not.toBeNull();
    expect(screen.queryByText("Heatmap")).toBeNull();

    await user.click(screen.getByLabelText(/hide tags/i));
    expect(screen.getByLabelText(/show tags/i)).not.toBeNull();
    expect(archiveRoute().style.gridColumn).toBe("3");
    expect(
      screen
        .getByLabelText("Tags")
        .firstElementChild?.classList.contains("tags-sidebar-window-controls"),
    ).toBe(true);

    await openBoardPanel(user);
    expect(screen.getByText(/^Boards$/i)).not.toBeNull();
    await user.click(screen.getByLabelText(/minimize board panel/i));
    expect(screen.getAllByLabelText(/open board panel/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^Board$/)).toBeNull();
  });
});
