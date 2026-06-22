import React, { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { FolioData, FolioItem, Project, ThumbnailUrls } from "../../types";
import { parseTimestamp } from "../folio/dates";
import { formatCount } from "../folio/model";
import { SettingsMenu } from "../layout/SettingsMenu";
import { ButtonIcon } from "../shared/ButtonIcon";
import { LazyThumbnail } from "../shared/LazyThumbnail";

const PROJECT_PREVIEW_LIMIT = 3;

function projectTime(project: Project): number {
  return parseTimestamp(project.updatedAt || project.createdAt);
}

function projectSortWeight(project: Project): number {
  if (project.status === "active" || !project.status) return 0;
  if (project.status === "paused") return 1;
  if (project.status === "done") return 2;
  return 3;
}

export function sortedProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) =>
      projectSortWeight(a) - projectSortWeight(b) ||
      projectTime(b) - projectTime(a) ||
      a.title.localeCompare(b.title),
  );
}

export function ProjectsView({
  data,
  busy,
  thumbUrls,
  setThumbUrls,
  onCreateProject,
  onOpenProject,
  onToast,
}: {
  data: FolioData;
  busy: boolean;
  thumbUrls: ThumbnailUrls;
  setThumbUrls: React.Dispatch<React.SetStateAction<ThumbnailUrls>>;
  onCreateProject: (title: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
  onToast: (message: string) => void;
}) {
  const [titleDraft, setTitleDraft] = useState("");
  const projects = useMemo(
    () => sortedProjects(data.projects ?? []),
    [data.projects],
  );
  const itemsById = useMemo(
    () => new Map(data.items.map((item) => [item.id, item])),
    [data.items],
  );

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title) return;
    await onCreateProject(title);
    setTitleDraft("");
  };

  return (
    <main className="projects-home">
      <div className="projects-titlebar-drag-area" aria-hidden="true" />
      <div className="projects-home-scroll">
        <section className="projects-header">
        <div>
          <p>Projects</p>
          <h1>Studio workspace</h1>
        </div>
        <div className="projects-header-actions">
          <form className="projects-create-form" onSubmit={createProject}>
            <label>
              <span>Project name</span>
              <input
                value={titleDraft}
                placeholder="New project"
                onChange={(event) => setTitleDraft(event.currentTarget.value)}
              />
            </label>
            <button
              className="primary-action"
              type="submit"
              disabled={busy || !titleDraft.trim()}
            >
              <ButtonIcon icon={Plus} />
              Create
            </button>
          </form>
          <SettingsMenu onToast={onToast} />
        </div>
      </section>

      {projects.length ? (
        <section className="projects-grid" aria-label="Projects">
          {projects.map((project) => {
            const usesWorkPreview = project.workItemIds.length > 0;
            const previewItemIds = usesWorkPreview
              ? project.workItemIds
              : project.imageIds;
            const memberItems = previewItemIds
              .map((itemId) => itemsById.get(itemId))
              .filter(Boolean) as FolioItem[];
            const previewItems = memberItems.slice(0, PROJECT_PREVIEW_LIMIT);
            const previewCount = Math.min(
              previewItems.length,
              PROJECT_PREVIEW_LIMIT,
            );
            const countNoun = usesWorkPreview ? "work" : "image";
            return (
              <article className="project-card canvas-board-tile" key={project.id}>
                <button
                  className="canvas-board-open-button"
                  type="button"
                  aria-label={`Open project ${project.title}, ${formatCount(
                    previewItemIds.length,
                    countNoun,
                  )}`}
                  onClick={() => onOpenProject(project.id)}
                >
                  <span
                    className={`canvas-board-cover canvas-board-cover-${previewCount}`}
                  >
                    {previewItems.length ? (
                      previewItems.map((item, index) => (
                        <span
                          className={`canvas-board-cover-slot canvas-board-cover-slot-${
                            index + 1
                          }`}
                          key={item.id}
                        >
                          <LazyThumbnail
                            item={item}
                            thumbUrls={thumbUrls}
                            setThumbUrls={setThumbUrls}
                          />
                        </span>
                      ))
                    ) : (
                      <span className="canvas-board-cover-empty">
                        <span className="canvas-board-cover-dot project-card-empty-dot" />
                      </span>
                    )}
                  </span>
                  <span className="canvas-board-tile-meta">
                    <span className="canvas-board-tile-title">
                      <span className="canvas-board-tile-dot project-card-kind-dot" />
                      <strong title={project.title}>{project.title}</strong>
                    </span>
                    <small>{formatCount(previewItemIds.length, countNoun)}</small>
                  </span>
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="projects-empty">
          <h2>No projects yet</h2>
          <p>{formatCount(data.items?.length ?? 0, "loose archive item")} available outside projects.</p>
        </section>
      )}
      </div>
    </main>
  );
}
