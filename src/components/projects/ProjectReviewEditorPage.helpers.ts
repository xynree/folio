import type { FolioItem, Project, ProjectReviewDocument } from "../../types";
import { basename } from "../folio/model";

export function reviewItemTitle(item: FolioItem): string {
  return item.title || basename(item.path);
}

export function reviewWorkIntro(item: FolioItem): string {
  return `\n\n## ${reviewItemTitle(item)}\n\n`;
}

export function reviewCandidateItems(
  project: Project,
  itemById: Map<string, FolioItem>,
): FolioItem[] {
  const projectImageIds = new Set(project.imageIds);
  const works = project.workItemIds
    .map((itemId) => itemById.get(itemId))
    .filter(
      (item): item is FolioItem => Boolean(item && projectImageIds.has(item.id)),
    );

  if (works.length) return works;

  return project.imageIds
    .map((itemId) => itemById.get(itemId))
    .filter((item): item is FolioItem => Boolean(item));
}

export function reviewWorkPatch(
  review: ProjectReviewDocument,
  markdownDraft: string,
  item: FolioItem,
): Pick<ProjectReviewDocument, "markdown" | "workItemIds"> {
  const isTagged = review.workItemIds.includes(item.id);
  const nextWorkItemIds = isTagged
    ? review.workItemIds.filter((itemId) => itemId !== item.id)
    : [...review.workItemIds, item.id];
  const heading = `## ${reviewItemTitle(item)}`;
  const markdown =
    isTagged || markdownDraft.includes(heading)
      ? markdownDraft
      : `${markdownDraft.trimEnd()}${reviewWorkIntro(item)}`;

  return { markdown, workItemIds: nextWorkItemIds };
}
