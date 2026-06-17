import { describe, expect, it } from "vitest";
import {
  CANVAS_TEMPLATES,
  canvasTemplateById,
  createCanvasFromTemplate,
} from "./canvasTemplates";

describe("canvas templates", () => {
  it("finds templates with blank as the fallback", () => {
    expect(CANVAS_TEMPLATES.map((template) => template.id)).toContain("moodboard");
    expect(canvasTemplateById("moodboard").name).toBe("Moodboard");
    expect(canvasTemplateById(undefined).id).toBe("blank");
  });

  it("creates editable canvases from template definitions", () => {
    let idCounter = 0;
    const canvas = createCanvasFromTemplate({
      index: 2,
      projectId: "project-1",
      templateId: "project-planning",
      createId: (prefix) => `${prefix}-${idCounter += 1}`,
      now: "2026-06-17T08:00:00.000Z",
    });

    expect(canvas).toMatchObject({
      title: "Project planning",
      projectId: "project-1",
      createdFromTemplate: "project-planning",
      createdAt: "2026-06-17T08:00:00.000Z",
      updatedAt: "2026-06-17T08:00:00.000Z",
    });
    expect(canvas.sections?.map((section) => section.title)).toEqual([
      "Brief",
      "References",
      "Work in progress",
      "Final pieces",
      "Open questions",
    ]);
    expect(canvas.sections?.[0]).toMatchObject({
      id: "section-1",
      color: canvas.color,
      x: 40,
      y: 40,
      width: 360,
      height: 220,
    });
    expect(canvas.texts?.[0]).toMatchObject({
      id: "text-6",
      text: "What is the work trying to resolve?",
      x: 70,
      y: 96,
    });
  });
});
