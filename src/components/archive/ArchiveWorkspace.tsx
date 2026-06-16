import type React from "react";

export function ArchiveWorkspace({
  sidebar,
  sidebarCollapsed,
  children,
}: {
  sidebar: React.ReactNode;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`archive-workspace ${
        sidebarCollapsed ? "archive-workspace-tags-collapsed" : ""
      }`}
    >
      {sidebar}
      <div className="archive-route">{children}</div>
    </section>
  );
}
