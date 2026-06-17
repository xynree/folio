import React, { useMemo, useState } from "react";
import { FolderOpen, Plus } from "lucide-react";
import type { FolioData, Project } from "../../types";
import { formatCount } from "../folio/model";
import { ButtonIcon } from "../shared/ButtonIcon";

function projectTime(project: Project): number {
  const time = Date.parse(project.updatedAt || project.createdAt);
  return Number.isNaN(time) ? 0 : time;
}

function formatProjectDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
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
  onCreateProject,
  onOpenProject,
}: {
  data: FolioData;
  busy: boolean;
  onCreateProject: (title: string) => Promise<void>;
  onOpenProject: (projectId: string) => void;
}) {
  const [titleDraft, setTitleDraft] = useState("");
  const projects = useMemo(
    () => sortedProjects(data.projects ?? []),
    [data.projects],
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
      <section className="projects-header">
        <div>
          <p>Projects</p>
          <h1>Studio workspace</h1>
        </div>
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
      </section>

      {projects.length ? (
        <section className="projects-grid" aria-label="Projects">
          {projects.map((project) => {
            const latestSaved = project.updatedAt || project.createdAt;
            return (
              <article className="project-card" key={project.id}>
                <div className="project-card-main">
                  <span className="project-status">{project.status ?? "active"}</span>
                  <h2>{project.title}</h2>
                  {project.description ? <p>{project.description}</p> : null}
                  <dl>
                    <div>
                      <dt>Images</dt>
                      <dd>{project.imageIds.length}</dd>
                    </div>
                    <div>
                      <dt>Works</dt>
                      <dd>{project.workItemIds.length}</dd>
                    </div>
                    <div>
                      <dt>Boards</dt>
                      <dd>{project.boardIds.length}</dd>
                    </div>
                  </dl>
                </div>
                <div className="project-card-footer">
                  <span>
                    Saved <time dateTime={latestSaved}>{formatProjectDate(latestSaved)}</time>
                  </span>
                  <span>{project.folderPath}</span>
                </div>
                <button
                  className="secondary-action project-open-button"
                  type="button"
                  onClick={() => onOpenProject(project.id)}
                >
                  <ButtonIcon icon={FolderOpen} />
                  Open project
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
    </main>
  );
}
