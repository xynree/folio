import { useCallback } from "react";
import type { Project, ProjectReviewDocument } from "../../types";
import type { DataUpdater } from "../folio/types";
import { createId } from "../folio/model";

type CommitData = (updater: DataUpdater, successMessage?: string) => void;

type UseProjectReviewsOptions = {
  activeProject: Project | null;
  commitData: CommitData;
  activeReviewId: string | null;
  setActiveReviewId: (reviewId: string | null) => void;
};

export type ProjectReviewActions = {
  createProjectReview: () => ProjectReviewDocument;
  updateProjectReview: (
    reviewId: string,
    patch: Partial<ProjectReviewDocument>,
  ) => void;
  deleteProjectReview: (reviewId: string) => void;
};

/**
 * Owns the create/update/delete lifecycle for the self-review documents that
 * live on the active project, keeping the review wiring isolated from the rest
 * of the app shell.
 */
export function useProjectReviews({
  activeProject,
  commitData,
  activeReviewId,
  setActiveReviewId,
}: UseProjectReviewsOptions): ProjectReviewActions {
  const createProjectReview = useCallback((): ProjectReviewDocument => {
    if (!activeProject) {
      throw new Error("No active project is open.");
    }

    const now = new Date().toISOString();
    const review: ProjectReviewDocument = {
      id: createId("review"),
      title: `Review ${(activeProject.reviews ?? []).length + 1}`,
      markdown: `# ${activeProject.title} review\n\n`,
      workItemIds: [],
      createdAt: now,
      updatedAt: now,
    };

    commitData(
      (current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === activeProject.id
            ? {
                ...project,
                reviews: [review, ...(project.reviews ?? [])],
                updatedAt: now,
              }
            : project,
        ),
      }),
      "Review created",
    );

    setActiveReviewId(review.id);

    return review;
  }, [activeProject, commitData, setActiveReviewId]);

  const updateProjectReview = useCallback(
    (reviewId: string, patch: Partial<ProjectReviewDocument>) => {
      if (!activeProject) return;
      const savedAt = new Date().toISOString();

      commitData((current) => ({
        ...current,
        projects: current.projects.map((project) =>
          project.id === activeProject.id
            ? {
                ...project,
                reviews: (project.reviews ?? []).map((review) =>
                  review.id === reviewId
                    ? {
                        ...review,
                        ...patch,
                        title: patch.title?.trim() || review.title,
                        updatedAt: savedAt,
                      }
                    : review,
                ),
                updatedAt: savedAt,
              }
            : project,
        ),
      }));
    },
    [activeProject, commitData],
  );

  const deleteProjectReview = useCallback(
    (reviewId: string) => {
      if (!activeProject) return;
      const savedAt = new Date().toISOString();

      commitData(
        (current) => ({
          ...current,
          projects: current.projects.map((project) =>
            project.id === activeProject.id
              ? {
                  ...project,
                  reviews: (project.reviews ?? []).filter(
                    (review) => review.id !== reviewId,
                  ),
                  updatedAt: savedAt,
                }
              : project,
          ),
        }),
        "Review deleted",
      );

      if (activeReviewId === reviewId) {
        setActiveReviewId(null);
      }
    },
    [activeProject, activeReviewId, commitData, setActiveReviewId],
  );

  return { createProjectReview, updateProjectReview, deleteProjectReview };
}
