import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { makeCanvas, makeItem } from "../../test/fixtures";
import { DetailDrawer } from "./DetailDrawer";
import { describe, expect, it, vi } from "vitest";

function renderDrawer(overrides = {}) {
  const props = {
    item: makeItem("alpha", {
      title: "Alpha",
      description: "Original notes",
      tagIds: ["tag-a"],
    }),
    tags: [{ id: "tag-a", text: "sketch" }],
    canvases: [makeCanvas("board-1", { title: "Board", itemIds: ["alpha"] })],
    thumbUrls: { alpha: "folio://thumb/alpha.jpg" },
    setThumbUrls: vi.fn(),
    initialFocus: "details" as const,
    onClose: vi.fn(),
    onPatch: vi.fn(),
    onAddTag: vi.fn(),
    onRemoveTag: vi.fn(),
    onAddToCanvas: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };

  render(<DetailDrawer {...props} />);
  return props;
}

describe("DetailDrawer", () => {
  it("renders nothing without an item", () => {
    const { container } = render(
      <DetailDrawer
        item={null}
        tags={[]}
        canvases={[]}
        thumbUrls={{}}
        setThumbUrls={vi.fn()}
        initialFocus="details"
        onClose={vi.fn()}
        onPatch={vi.fn()}
        onAddTag={vi.fn()}
        onRemoveTag={vi.fn()}
        onAddToCanvas={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(container.firstElementChild).toBeNull();
  });

  it("saves changed metadata and closes from the overlay", async () => {
    const props = renderDrawer();

    fireEvent.change(screen.getByDisplayValue("Alpha"), {
      target: { value: "Updated Alpha" },
    });
    fireEvent.change(screen.getByDisplayValue("Original notes"), {
      target: { value: "New notes" },
    });
    fireEvent.change(screen.getByLabelText("Stage"), {
      target: { value: "final" },
    });
    fireEvent.click(screen.getByText("Save"));
    fireEvent.mouseDown(document.querySelector(".detail-modal-overlay") as HTMLElement);

    expect(props.onPatch).toHaveBeenCalledWith(
      "alpha",
      { title: "Updated Alpha", description: "New notes", stage: "final" },
      "Details saved",
    );
    expect(props.onClose).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByLabelText("Item details")).not.toBeNull(),
    );
  });

  it("handles tags, board membership, finder, and delete actions", () => {
    const props = renderDrawer({ initialFocus: "tags" as const });

    fireEvent.click(screen.getByText("sketch"));
    fireEvent.change(screen.getByPlaceholderText("Tag name"), {
      target: { value: "process" },
    });
    fireEvent.keyDown(screen.getByPlaceholderText("Tag name"), {
      key: "Enter",
    });
    fireEvent.click(screen.getByText("Add to board"));
    fireEvent.click(screen.getByText("Show in Finder"));
    fireEvent.click(screen.getByText("Delete"));

    expect(screen.getByText("Board")).not.toBeNull();
    expect(props.onRemoveTag).toHaveBeenCalledWith("alpha", "sketch");
    expect(props.onAddTag).toHaveBeenCalledWith("alpha", "process");
    expect(props.onAddToCanvas).toHaveBeenCalledWith("alpha");
    expect(window.folio.openInFinder).toHaveBeenCalledWith(
      "items/2026/06_june/alpha.png",
    );
    expect(props.onDelete).toHaveBeenCalledWith("alpha");
  });
});
