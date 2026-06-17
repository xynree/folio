import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { makeCanvas, makeItem } from "../../test/fixtures";
import type { Canvas, FolioItem, Tag, ThumbnailUrls } from "../../types";
import { ArchiveWorkspace } from "./ArchiveWorkspace";
import { DailyStripView } from "./DailyStripView";
import { GridView } from "./GridView";
import { ArchiveHeatmap } from "./HeatmapView";
import { ItemCard } from "./ItemCard";
import { TagsSidebar } from "./TagsSidebar";

const tags: Tag[] = [
  { id: "tag-a", text: "sketch" },
  { id: "tag-b", text: "reference" },
];

const items: FolioItem[] = [
  makeItem("alpha", {
    title: "Alpha",
    tagIds: ["tag-a"],
    date: "2026-06-15T08:00:00.000Z",
  }),
  makeItem("bravo", {
    title: "Bravo",
    tagIds: ["tag-b"],
    date: "2026-06-16T08:00:00.000Z",
  }),
];

const canvases: Canvas[] = [
  makeCanvas("board-1", {
    title: "Board",
    itemIds: ["alpha"],
    color: "#385d56",
  }),
];

const thumbUrls: ThumbnailUrls = {
  alpha: "folio://thumb/alpha.jpg",
  bravo: "folio://thumb/bravo.jpg",
};

function noopProps() {
  return {
    onBackgroundClick: vi.fn(),
    onDragStart: vi.fn(),
    onEditItem: vi.fn(),
    onItemOpen: vi.fn(),
    setThumbUrls: vi.fn(),
  };
}

describe("archive components", () => {
  it("opens item cards and edits on double click without card overflow actions", () => {
    const onOpen = vi.fn();
    const onEdit = vi.fn();

    render(
      <ItemCard
        item={items[0]}
        tags={tags}
        canvasColors={["#385d56"]}
        thumbUrls={thumbUrls}
        setThumbUrls={vi.fn()}
        isSelected
        onDragStart={vi.fn()}
        onOpen={onOpen}
        onEdit={onEdit}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Alpha/ })[0]);
    fireEvent.doubleClick(screen.getAllByRole("button", { name: /Alpha/ })[0]);

    expect(onOpen).toHaveBeenCalledWith("alpha", expect.any(Object));
    expect(onEdit).toHaveBeenCalledWith("alpha");
    expect(screen.queryByLabelText("More actions for Alpha")).toBeNull();
  });

  it("filters and expands tag sidebar thumbnails", async () => {
    const setTagFilter = vi.fn();
    const onOpenItem = vi.fn();

    render(
      <TagsSidebar
        items={items}
        tags={tags}
        canvases={canvases}
        thumbUrls={thumbUrls}
        setThumbUrls={vi.fn()}
        onOpenItem={onOpenItem}
        collapsed={false}
        onToggleCollapsed={vi.fn()}
        tagFilter="all"
        setTagFilter={setTagFilter}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /^sketch/ }));
    fireEvent.click(screen.getByLabelText("Expand sketch"));
    fireEvent.click(await screen.findByTitle("Alpha"));

    expect(setTagFilter).toHaveBeenCalledWith("tag-a");
    expect(onOpenItem).toHaveBeenCalledWith("alpha");
  });

  it("renders the collapsed tag sidebar toggle", () => {
    const onToggleCollapsed = vi.fn();

    render(
      <TagsSidebar
        items={[]}
        tags={[]}
        canvases={[]}
        thumbUrls={{}}
        setThumbUrls={vi.fn()}
        onOpenItem={vi.fn()}
        collapsed
        onToggleCollapsed={onToggleCollapsed}
        tagFilter="all"
        setTagFilter={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText("Show tags"));
    expect(onToggleCollapsed).toHaveBeenCalledTimes(1);
  });

  it("sorts and filters grid items", () => {
    const props = noopProps();
    const setTagFilter = vi.fn();

    const { container } = render(
      <GridView
        items={items}
        tags={tags}
        canvases={canvases}
        thumbUrls={thumbUrls}
        setThumbUrls={props.setThumbUrls}
        tagFilter="all"
        setTagFilter={setTagFilter}
        selectedItemIds={["alpha"]}
        workItemIds={["alpha"]}
        onBackgroundClick={props.onBackgroundClick}
        onDragStart={props.onDragStart}
        onItemOpen={props.onItemOpen}
        onEditItem={props.onEditItem}
      />,
    );

    expect(
      Array.from(container.querySelectorAll(".item-title")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["Bravo", "Alpha"]);
    expect(screen.getAllByTitle("Marked as Work")).toHaveLength(1);

    fireEvent.change(screen.getByLabelText("Sort grid items"), {
      target: { value: "title" },
    });
    const filterBar = screen.getByLabelText("Tags");
    fireEvent.click(within(filterBar).getByRole("button", { name: /sketch/ }));
    fireEvent.mouseDown(container.querySelector(".grid-view") as HTMLElement);

    expect(
      Array.from(container.querySelectorAll(".item-title")).map(
        (node) => node.textContent,
      ),
    ).toEqual(["Alpha", "Bravo"]);
    expect(setTagFilter).toHaveBeenCalledWith("tag-a");
    expect(props.onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it("renders daily strip rows and persists scroll position", () => {
    const props = noopProps();

    const { container } = render(
      <DailyStripView
        items={items}
        tags={tags}
        canvases={canvases}
        thumbUrls={thumbUrls}
        setThumbUrls={props.setThumbUrls}
        selectedItemIds={["bravo"]}
        workItemIds={["alpha"]}
        showDateGaps={false}
        onBackgroundClick={props.onBackgroundClick}
        onDragStart={props.onDragStart}
        onItemOpen={props.onItemOpen}
        onEditItem={props.onEditItem}
      />,
    );

    const strip = container.querySelector(".strip-view") as HTMLElement;
    Object.defineProperty(strip, "scrollTop", { configurable: true, value: 42 });
    fireEvent.scroll(strip);

    expect(screen.getByText("Tue, Jun 16, 2026")).not.toBeNull();
    expect(screen.getByText("Mon, Jun 15, 2026")).not.toBeNull();
    expect(screen.getAllByTitle("Marked as Work")).toHaveLength(1);
    expect(sessionStorage.getItem("folio:strip-scroll")).toBe("42");
  });

  it("renders empty daily strips", () => {
    render(
      <DailyStripView
        items={[]}
        tags={tags}
        canvases={canvases}
        thumbUrls={{}}
        setThumbUrls={vi.fn()}
        selectedItemIds={[]}
        showDateGaps={false}
        onBackgroundClick={vi.fn()}
        onDragStart={vi.fn()}
        onItemOpen={vi.fn()}
        onEditItem={vi.fn()}
      />,
    );

    expect(screen.getByText("No archive items yet")).not.toBeNull();
  });

  it("renders heatmap upload cells and supports horizontal wheel scrolling", () => {
    const { container } = render(<ArchiveHeatmap items={items} />);
    const scroller = container.querySelector(".archive-heatmap-scroll") as HTMLElement;
    Object.defineProperties(scroller, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 500 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });

    fireEvent.wheel(scroller, { deltaY: 40 });

    expect(screen.getByRole("grid", { name: "Uploads by day" })).not.toBeNull();
    expect(scroller.scrollLeft).toBe(40);
  });

  it("lays out archive workspace and disables resize when collapsed", () => {
    const onStartSidebarResize = vi.fn();
    const { rerender } = render(
      <ArchiveWorkspace
        sidebar={<aside>Tags</aside>}
        sidebarCollapsed={false}
        sidebarWidth={260}
        onStartSidebarResize={onStartSidebarResize}
      >
        <main>Archive</main>
      </ArchiveWorkspace>,
    );

    fireEvent.pointerDown(screen.getByRole("separator", { name: "Resize tags panel" }));
    expect(onStartSidebarResize).toHaveBeenCalledTimes(1);

    rerender(
      <ArchiveWorkspace
        sidebar={<aside>Tags</aside>}
        sidebarCollapsed
        sidebarWidth={260}
        onStartSidebarResize={onStartSidebarResize}
      >
        <main>Archive</main>
      </ArchiveWorkspace>,
    );
    fireEvent.pointerDown(screen.getByRole("separator", { hidden: true }));

    expect(onStartSidebarResize).toHaveBeenCalledTimes(1);
  });
});
