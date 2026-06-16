import type React from "react";

export function ArchiveWorkspace({
  sidebar,
  sidebarCollapsed,
  children,
  onStartSidebarResize,
  routeStyle,
  sidebarWidth,
}: {
  sidebar: React.ReactNode;
  sidebarCollapsed: boolean;
  children: React.ReactNode;
  onStartSidebarResize: (event: React.PointerEvent<HTMLDivElement>) => void;
  routeStyle?: React.CSSProperties;
  sidebarWidth: number;
}) {
  return (
    <section
      className={`archive-workspace ${
        sidebarCollapsed ? "archive-workspace-tags-collapsed" : ""
      }`}
      style={
        {
          "--archive-sidebar-width": `${sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      {sidebar}
      <div
        className="archive-sidebar-resize-handle"
        role="separator"
        aria-label="Resize tags panel"
        aria-orientation="vertical"
        aria-hidden={sidebarCollapsed}
        tabIndex={sidebarCollapsed ? -1 : 0}
        onPointerDown={(event) => {
          if (sidebarCollapsed) return;
          onStartSidebarResize(event);
        }}
      />
      <div
        className="archive-route"
        style={{ gridColumn: "3", ...routeStyle }}
      >
        <div className="archive-titlebar-drag-area" aria-hidden="true" />
        {children}
      </div>
    </section>
  );
}
