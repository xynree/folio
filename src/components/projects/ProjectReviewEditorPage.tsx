import React, { useEffect, useMemo, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import {
  codeEdit,
  codeLive,
  codePreview,
  type ICommand,
} from "@uiw/react-md-editor/commands";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import { ArrowLeft, Trash2 } from "lucide-react";
import type {
  FolioItem,
  Project,
  ProjectReviewDocument,
  ThumbnailUrls,
} from "../../types";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";
import {
  reviewCandidateItems,
  reviewItemTitle,
  reviewWorkPatch,
} from "./ProjectReviewEditorPage.helpers";

// Only the edit / live / preview view toggles. The library's default toolbar
// also injects a fullscreen command, which we intentionally leave out.
const EDITOR_VIEW_COMMANDS: ICommand[] = [codeEdit, codeLive, codePreview];

export function ProjectReviewEditorPage({
  project,
  review,
  items,
  thumbUrls,
  setThumbUrls,
  onBackToProjectReview,
  onUpdateReview,
  onDeleteReview,
}: {
  project: Project;
  review: ProjectReviewDocument;
  items: FolioItem[];
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onBackToProjectReview: () => void;
  onUpdateReview: (
    reviewId: string,
    patch: Partial<ProjectReviewDocument>,
  ) => void;
  onDeleteReview: (reviewId: string) => void;
}) {
  const [titleDraft, setTitleDraft] = useState(review.title);
  const [markdownDraft, setMarkdownDraft] = useState(review.markdown);
  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const taggedWorkIds = useMemo(
    () => new Set(review.workItemIds),
    [review.workItemIds],
  );
  const reviewCandidates = useMemo(
    () => reviewCandidateItems(project, itemById),
    [itemById, project],
  );

  useEffect(() => {
    setTitleDraft(review.title);
    setMarkdownDraft(review.markdown);
  }, [review.id, review.markdown, review.title]);

  useEffect(() => {
    if (markdownDraft === review.markdown) return undefined;
    const timeout = window.setTimeout(() => {
      onUpdateReview(review.id, { markdown: markdownDraft });
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [markdownDraft, onUpdateReview, review.id, review.markdown]);

  const saveTitle = () => {
    const nextTitle = titleDraft.trim() || "Untitled review";
    if (nextTitle === review.title) return;
    onUpdateReview(review.id, { title: nextTitle });
  };

  const toggleWorkTag = (item: FolioItem) => {
    const patch = reviewWorkPatch(review, markdownDraft, item);
    setMarkdownDraft(patch.markdown);
    onUpdateReview(review.id, patch);
  };

  const deleteReview = () => {
    const confirmed = window.confirm(`Delete "${review.title}"?`);
    if (!confirmed) return;
    onDeleteReview(review.id);
  };

  return (
    <main className="review-editor-page" aria-label="Review editor">
      <div className="review-editor-titlebar">
        <button
          className="icon-button review-editor-back-button"
          type="button"
          aria-label="Back to review"
          title="Back to review"
          onClick={onBackToProjectReview}
        >
          <ButtonIcon icon={ArrowLeft} />
        </button>
        <strong>{project.title}</strong>
      </div>

      <section className="review-editor-surface">
        <header className="project-review-editor-header">
          <label>
            <span>Review title</span>
            <input
              aria-label="Review title"
              value={titleDraft}
              onBlur={saveTitle}
              onChange={(event) => setTitleDraft(event.currentTarget.value)}
            />
          </label>
          <button
            className="secondary-action"
            type="button"
            onClick={deleteReview}
          >
            <ButtonIcon icon={Trash2} />
            Delete
          </button>
        </header>

        <div className="review-editor-body">
          <section className="project-review-work-selector" aria-label="Review Works">
            {reviewCandidates.length ? (
              <div className="project-review-work-grid">
                {reviewCandidates.map((item) => {
                  const title = reviewItemTitle(item);
                  const isTagged = taggedWorkIds.has(item.id);
                  return (
                    <article
                      className={`project-review-work-card ${
                        isTagged ? "project-review-work-card-added" : ""
                      } ${item.missing ? "project-review-work-card-missing" : ""}`}
                      key={item.id}
                    >
                      <button
                        className="project-review-work-preview"
                        type="button"
                        aria-label={
                          isTagged
                            ? `Remove ${title} from review`
                            : item.missing
                              ? `${title} is missing`
                              : `Attach ${title} to review`
                        }
                        aria-pressed={isTagged}
                        title={title}
                        disabled={item.missing}
                        onClick={() => toggleWorkTag(item)}
                      >
                        <LazyThumbnail
                          item={item}
                          thumbUrls={thumbUrls}
                          setThumbUrls={setThumbUrls}
                        />
                      </button>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="project-review-work-empty">No project images yet</p>
            )}
          </section>

          <div className="project-markdown-editor" data-color-mode="light">
            <MDEditor
              extraCommands={EDITOR_VIEW_COMMANDS}
              height={520}
              preview="live"
              value={markdownDraft}
              onChange={(value) => setMarkdownDraft(value ?? "")}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
