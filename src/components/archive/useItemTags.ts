import { useCallback } from "react";
import type { FolioItem } from "../../types";
import type { DataUpdater } from "../folio/types";
import { createId, formatCount } from "../folio/model";

type CommitData = (updater: DataUpdater, successMessage?: string) => void;

type UseItemTagsOptions = {
  commitData: CommitData;
  selectedItemIds: string[];
  onSelectionTagged: () => void;
};

export type ItemTagActions = {
  patchItem: (
    itemId: string,
    patch: Partial<FolioItem>,
    successMessage?: string,
  ) => void;
  addTagToItem: (itemId: string, text: string) => void;
  addTagToSelection: (text: string) => void;
  removeTagFromItem: (itemId: string, tagText: string) => void;
};

/**
 * Groups the item metadata and tagging mutations so tag wiring (including the
 * dedupe + unused-tag cleanup rules) lives in one isolated, testable place.
 */
export function useItemTags({
  commitData,
  selectedItemIds,
  onSelectionTagged,
}: UseItemTagsOptions): ItemTagActions {
  const patchItem = useCallback(
    (itemId: string, patch: Partial<FolioItem>, successMessage?: string) => {
      commitData(
        (current) => ({
          ...current,
          items: current.items.map((item) =>
            item.id === itemId ? { ...item, ...patch } : item,
          ),
        }),
        successMessage,
      );
    },
    [commitData],
  );

  const addTagToItem = useCallback(
    (itemId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      commitData((current) => {
        const existingTag = current.tags.find(
          (tag) => tag.text.toLowerCase() === trimmed.toLowerCase(),
        );
        const tag = existingTag ?? { id: createId("tag"), text: trimmed };

        return {
          ...current,
          tags: existingTag ? current.tags : [...current.tags, tag],
          items: current.items.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  tagIds: item.tagIds.includes(tag.id)
                    ? item.tagIds
                    : [...item.tagIds, tag.id],
                }
              : item,
          ),
        };
      }, "Tag added");
    },
    [commitData],
  );

  const addTagToSelection = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let taggedCount = 0;
      commitData(
        (current) => {
          const selectedSet = new Set(selectedItemIds);
          const validSelectedIds = new Set(
            current.items
              .filter((item) => selectedSet.has(item.id))
              .map((item) => item.id),
          );
          taggedCount = validSelectedIds.size;
          if (!taggedCount) return current;

          const existingTag = current.tags.find(
            (tag) => tag.text.toLowerCase() === trimmed.toLowerCase(),
          );
          const tag = existingTag ?? { id: createId("tag"), text: trimmed };

          return {
            ...current,
            tags: existingTag ? current.tags : [...current.tags, tag],
            items: current.items.map((item) =>
              validSelectedIds.has(item.id)
                ? {
                    ...item,
                    tagIds: item.tagIds.includes(tag.id)
                      ? item.tagIds
                      : [...item.tagIds, tag.id],
                  }
                : item,
            ),
          };
        },
        `${formatCount(taggedCount || selectedItemIds.length, "item")} tagged`,
      );

      if (taggedCount) {
        onSelectionTagged();
      }
    },
    [commitData, onSelectionTagged, selectedItemIds],
  );

  const removeTagFromItem = useCallback(
    (itemId: string, tagText: string) => {
      commitData((current) => {
        const tag = current.tags.find(
          (candidate) => candidate.text === tagText,
        );
        if (!tag) return current;

        const items = current.items.map((item) =>
          item.id === itemId
            ? {
                ...item,
                tagIds: item.tagIds.filter((tagId) => tagId !== tag.id),
              }
            : item,
        );
        const usedTagIds = new Set(items.flatMap((item) => item.tagIds));

        return {
          ...current,
          items,
          tags: current.tags.filter((candidate) =>
            usedTagIds.has(candidate.id),
          ),
        };
      }, "Tag removed");
    },
    [commitData],
  );

  return { patchItem, addTagToItem, addTagToSelection, removeTagFromItem };
}
