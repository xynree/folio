import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useItemTags } from "./useItemTags";
import { makeData, makeItem } from "../../test/fixtures";
import type { DataUpdater } from "../folio/types";
import type { FolioData } from "../../types";

function setup(options?: {
  data?: FolioData;
  selectedItemIds?: string[];
  onSelectionTagged?: () => void;
}) {
  const data =
    options?.data ??
    makeData({
      items: [makeItem("alpha"), makeItem("bravo")],
      tags: [],
    });
  const commits: Array<{ next: FolioData; message?: string }> = [];
  const commitData = vi.fn((updater: DataUpdater, message?: string) => {
    commits.push({ next: updater(data), message });
  });
  const onSelectionTagged = options?.onSelectionTagged ?? vi.fn();

  const { result } = renderHook(() =>
    useItemTags({
      commitData,
      selectedItemIds: options?.selectedItemIds ?? [],
      onSelectionTagged,
    }),
  );

  return { result, commits, commitData, onSelectionTagged, data };
}

describe("useItemTags", () => {
  it("patches an item with the provided fields", () => {
    const { result, commits } = setup();

    result.current.patchItem("alpha", { title: "Renamed" }, "Saved");

    const patched = commits[0].next.items.find((item) => item.id === "alpha");
    expect(patched?.title).toBe("Renamed");
    expect(commits[0].message).toBe("Saved");
  });

  it("creates a new tag and assigns it to an item", () => {
    const { result, commits } = setup();

    result.current.addTagToItem("alpha", "  Studio  ");

    const next = commits[0].next;
    const tag = next.tags.find((candidate) => candidate.text === "Studio");
    expect(tag).toBeDefined();
    const alpha = next.items.find((item) => item.id === "alpha");
    expect(alpha?.tagIds).toContain(tag?.id);
  });

  it("reuses an existing tag case-insensitively and does not duplicate", () => {
    const data = makeData({
      items: [makeItem("alpha", { tagIds: ["tag-1"] }), makeItem("bravo")],
      tags: [{ id: "tag-1", text: "Studio" }],
    });
    const { result, commits } = setup({ data });

    result.current.addTagToItem("bravo", "studio");

    const next = commits[0].next;
    expect(next.tags).toHaveLength(1);
    const bravo = next.items.find((item) => item.id === "bravo");
    expect(bravo?.tagIds).toEqual(["tag-1"]);
  });

  it("ignores blank tag text", () => {
    const { result, commitData } = setup();
    result.current.addTagToItem("alpha", "   ");
    expect(commitData).not.toHaveBeenCalled();
  });

  it("tags the current selection and notifies when items changed", () => {
    const onSelectionTagged = vi.fn();
    const { result, commits } = setup({
      selectedItemIds: ["alpha", "bravo"],
      onSelectionTagged,
    });

    result.current.addTagToSelection("Batch");

    const next = commits[0].next;
    const tag = next.tags.find((candidate) => candidate.text === "Batch");
    expect(
      next.items.every((item) => item.tagIds.includes(tag?.id ?? "")),
    ).toBe(true);
    expect(commits[0].message).toBe("2 items tagged");
    expect(onSelectionTagged).toHaveBeenCalledTimes(1);
  });

  it("does not notify when the selection matches no items", () => {
    const onSelectionTagged = vi.fn();
    const { result } = setup({
      selectedItemIds: ["missing"],
      onSelectionTagged,
    });

    result.current.addTagToSelection("Batch");

    expect(onSelectionTagged).not.toHaveBeenCalled();
  });

  it("removes a tag from an item and prunes unused tags", () => {
    const data = makeData({
      items: [makeItem("alpha", { tagIds: ["tag-1"] })],
      tags: [{ id: "tag-1", text: "Studio" }],
    });
    const { result, commits } = setup({ data });

    result.current.removeTagFromItem("alpha", "Studio");

    const next = commits[0].next;
    expect(next.items[0].tagIds).toEqual([]);
    expect(next.tags).toHaveLength(0);
  });

  it("is a no-op when removing a tag that does not exist", () => {
    const data = makeData({
      items: [makeItem("alpha", { tagIds: ["tag-1"] })],
      tags: [{ id: "tag-1", text: "Studio" }],
    });
    const { result, commits } = setup({ data });

    result.current.removeTagFromItem("alpha", "Unknown");

    expect(commits[0].next).toBe(data);
  });
});
