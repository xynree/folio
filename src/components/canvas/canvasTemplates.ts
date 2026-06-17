import type { Canvas, CanvasSection, CanvasTextElement } from "../../types";
import { CANVAS_COLORS } from "../folio/constants";
import { createCanvas } from "../folio/model";

export type CanvasTemplateId =
  | "blank"
  | "project-planning"
  | "moodboard"
  | "research-map"
  | "work-review"
  | "process-timeline"
  | "comparison-board";

export type CanvasTemplateDefinition = {
  id: CanvasTemplateId;
  name: string;
  description: string;
  title: string;
  color: string;
  sections: Array<{
    title: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  textPrompts?: Array<{
    text: string;
    x: number;
    y: number;
    size?: CanvasTextElement["size"];
  }>;
};

export const CANVAS_TEMPLATES: CanvasTemplateDefinition[] = [
  {
    id: "blank",
    name: "Blank board",
    description: "Start with an empty canvas.",
    title: "Untitled board",
    color: CANVAS_COLORS[0],
    sections: [],
  },
  {
    id: "project-planning",
    name: "Project planning",
    description: "Brief, references, work in progress, final pieces, and questions.",
    title: "Project planning",
    color: CANVAS_COLORS[1],
    sections: [
      { title: "Brief", x: 40, y: 40, width: 360, height: 220 },
      { title: "References", x: 440, y: 40, width: 520, height: 320 },
      { title: "Work in progress", x: 40, y: 320, width: 520, height: 340 },
      { title: "Final pieces", x: 600, y: 420, width: 360, height: 240 },
      { title: "Open questions", x: 1000, y: 40, width: 360, height: 300 },
    ],
    textPrompts: [{ text: "What is the work trying to resolve?", x: 70, y: 96 }],
  },
  {
    id: "moodboard",
    name: "Moodboard",
    description: "Collect visual references, materials, tone, and patterns.",
    title: "Moodboard",
    color: CANVAS_COLORS[2],
    sections: [
      { title: "Visual references", x: 40, y: 40, width: 520, height: 360 },
      { title: "Color/material", x: 600, y: 40, width: 360, height: 260 },
      { title: "Type/tone", x: 1000, y: 40, width: 360, height: 260 },
      { title: "Patterns", x: 40, y: 440, width: 520, height: 260 },
      { title: "Notes", x: 600, y: 340, width: 360, height: 260 },
    ],
  },
  {
    id: "research-map",
    name: "Research map",
    description: "Connect sources, claims, evidence, questions, and follow-ups.",
    title: "Research map",
    color: CANVAS_COLORS[3],
    sections: [
      { title: "Sources", x: 40, y: 40, width: 360, height: 320 },
      { title: "Claims/ideas", x: 440, y: 40, width: 420, height: 320 },
      { title: "Evidence", x: 900, y: 40, width: 420, height: 320 },
      { title: "Open questions", x: 240, y: 420, width: 420, height: 260 },
      { title: "Follow-ups", x: 700, y: 420, width: 420, height: 260 },
    ],
  },
  {
    id: "work-review",
    name: "Work review",
    description: "Review current Works, revisions, feedback notes, and experiments.",
    title: "Work review",
    color: CANVAS_COLORS[4],
    sections: [
      { title: "Current Works", x: 40, y: 40, width: 500, height: 340 },
      { title: "Revisions", x: 580, y: 40, width: 420, height: 340 },
      { title: "Feedback notes", x: 1040, y: 40, width: 360, height: 340 },
      { title: "Next experiments", x: 360, y: 440, width: 520, height: 260 },
    ],
  },
  {
    id: "process-timeline",
    name: "Process timeline",
    description: "Arrange sketches, iterations, decisions, and final direction.",
    title: "Process timeline",
    color: CANVAS_COLORS[5],
    sections: [
      { title: "Early sketches", x: 40, y: 80, width: 320, height: 300 },
      { title: "Iterations", x: 420, y: 80, width: 440, height: 300 },
      { title: "Decisions", x: 920, y: 80, width: 320, height: 300 },
      { title: "Final direction", x: 1300, y: 80, width: 360, height: 300 },
    ],
  },
  {
    id: "comparison-board",
    name: "Comparison board",
    description: "Compare options, patterns, and tradeoffs.",
    title: "Comparison board",
    color: CANVAS_COLORS[6],
    sections: [
      { title: "Option A", x: 40, y: 40, width: 440, height: 360 },
      { title: "Option B", x: 520, y: 40, width: 440, height: 360 },
      { title: "Shared patterns", x: 1000, y: 40, width: 360, height: 240 },
      { title: "Tradeoffs", x: 1000, y: 320, width: 360, height: 240 },
    ],
  },
];

export function canvasTemplateById(
  templateId: CanvasTemplateId | undefined,
): CanvasTemplateDefinition {
  return (
    CANVAS_TEMPLATES.find((template) => template.id === templateId)
    ?? CANVAS_TEMPLATES[0]
  );
}

export function createCanvasFromTemplate({
  index,
  projectId,
  templateId,
  createId,
  now = new Date().toISOString(),
}: {
  index: number;
  projectId?: string;
  templateId?: CanvasTemplateId;
  createId: (prefix: string) => string;
  now?: string;
}): Canvas {
  const template = canvasTemplateById(templateId);
  const baseCanvas = createCanvas(index, template.title);
  const sections: CanvasSection[] = template.sections.map((section) => ({
    id: createId("section"),
    title: section.title,
    color: template.color,
    x: section.x,
    y: section.y,
    width: section.width,
    height: section.height,
    createdAt: now,
    updatedAt: now,
  }));
  const texts: CanvasTextElement[] = (template.textPrompts ?? []).map((prompt) => ({
    id: createId("text"),
    text: prompt.text,
    size: prompt.size ?? "md",
    x: prompt.x,
    y: prompt.y,
    createdAt: now,
    updatedAt: now,
  }));

  return {
    ...baseCanvas,
    color: template.color,
    createdAt: now,
    updatedAt: now,
    projectId,
    sections,
    texts,
    createdFromTemplate: template.id,
  };
}
