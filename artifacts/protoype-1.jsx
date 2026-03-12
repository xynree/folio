import { useState, useRef, useEffect, useCallback, useMemo } from "react";

const EXTENDED_ITEMS = [
  {
    id: 101,
    type: "sketch",
    date: "2025-09-02",
    title: "loose warm-up",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 102,
    type: "sketch",
    date: "2025-09-02",
    title: "gesture study",
    hue: "160,108,64",
    tags: ["figures"],
  },
  {
    id: 103,
    type: "reference",
    date: "2025-09-05",
    title: "van eyck detail",
    hue: "110,96,80",
    tags: ["masters"],
  },
  {
    id: 104,
    type: "sketch",
    date: "2025-09-08",
    title: "hand study",
    hue: "176,120,72",
    tags: ["hands"],
  },
  {
    id: 105,
    type: "music",
    date: "2025-09-10",
    title: "ambient loop",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 106,
    type: "sketch",
    date: "2025-09-12",
    title: "street scene",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 107,
    type: "sketch",
    date: "2025-09-12",
    title: "figure block-in",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 108,
    type: "sketch",
    date: "2025-09-15",
    title: "portrait rough",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 109,
    type: "reference",
    date: "2025-09-18",
    title: "klimt pattern ref",
    hue: "110,96,80",
    tags: ["masters"],
  },
  {
    id: 110,
    type: "sketch",
    date: "2025-09-20",
    title: "cafe sketch",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 111,
    type: "sketch",
    date: "2025-09-22",
    title: "torso study",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 112,
    type: "animation",
    date: "2025-09-25",
    title: "bounce test",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 113,
    type: "sketch",
    date: "2025-09-27",
    title: "window light",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 114,
    type: "sketch",
    date: "2025-09-28",
    title: "interior corner",
    hue: "140,116,100",
    tags: ["interiors"],
  },
  {
    id: 115,
    type: "sketch",
    date: "2025-10-01",
    title: "morning figure",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 116,
    type: "sketch",
    date: "2025-10-01",
    title: "quick hand",
    hue: "160,108,64",
    tags: ["hands"],
  },
  {
    id: 117,
    type: "sketch",
    date: "2025-10-01",
    title: "drapery study",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 118,
    type: "reference",
    date: "2025-10-03",
    title: "sargent watercolor",
    hue: "110,96,80",
    tags: ["masters", "light"],
  },
  {
    id: 119,
    type: "sketch",
    date: "2025-10-06",
    title: "seated figure",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 120,
    type: "music",
    date: "2025-10-08",
    title: "piano sketch",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 121,
    type: "sketch",
    date: "2025-10-10",
    title: "crowd scene",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 122,
    type: "sketch",
    date: "2025-10-13",
    title: "figure study",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 123,
    type: "sketch",
    date: "2025-10-13",
    title: "anatomy notes",
    hue: "176,120,72",
    tags: ["anatomy"],
  },
  {
    id: 124,
    type: "animation",
    date: "2025-10-15",
    title: "run cycle draft",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 125,
    type: "sketch",
    date: "2025-10-17",
    title: "light study",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 126,
    type: "sketch",
    date: "2025-10-20",
    title: "portrait block",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 127,
    type: "reference",
    date: "2025-10-22",
    title: "degas pastel ref",
    hue: "110,96,80",
    tags: ["masters", "figures"],
  },
  {
    id: 128,
    type: "sketch",
    date: "2025-10-24",
    title: "gesture warmup",
    hue: "160,108,64",
    tags: ["figures"],
  },
  {
    id: 129,
    type: "sketch",
    date: "2025-10-27",
    title: "shadow study",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 130,
    type: "sketch",
    date: "2025-10-27",
    title: "interior corner",
    hue: "140,116,100",
    tags: ["interiors"],
  },
  {
    id: 131,
    type: "music",
    date: "2025-10-29",
    title: "string idea",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 132,
    type: "sketch",
    date: "2025-10-31",
    title: "costume ref",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 133,
    type: "sketch",
    date: "2025-11-03",
    title: "morning warmup",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 134,
    type: "sketch",
    date: "2025-11-05",
    title: "foreshortening",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 135,
    type: "sketch",
    date: "2025-11-05",
    title: "foreshortening 2",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 136,
    type: "reference",
    date: "2025-11-07",
    title: "ribera tenebrism",
    hue: "110,96,80",
    tags: ["masters", "light"],
  },
  {
    id: 137,
    type: "sketch",
    date: "2025-11-10",
    title: "window with curtain",
    hue: "140,116,100",
    tags: ["light", "interiors"],
  },
  {
    id: 138,
    type: "sketch",
    date: "2025-11-12",
    title: "quick gesture x3",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 139,
    type: "animation",
    date: "2025-11-14",
    title: "cloth sim test",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 140,
    type: "sketch",
    date: "2025-11-17",
    title: "profile study",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 141,
    type: "music",
    date: "2025-11-19",
    title: "drone layer",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 142,
    type: "sketch",
    date: "2025-11-21",
    title: "hands again",
    hue: "160,108,64",
    tags: ["hands"],
  },
  {
    id: 143,
    type: "sketch",
    date: "2025-11-24",
    title: "seated pose",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 144,
    type: "sketch",
    date: "2025-12-01",
    title: "winter figure",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 145,
    type: "sketch",
    date: "2025-12-03",
    title: "value study",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 146,
    type: "reference",
    date: "2025-12-05",
    title: "hogarth hands",
    hue: "110,96,80",
    tags: ["masters", "hands"],
  },
  {
    id: 147,
    type: "sketch",
    date: "2025-12-08",
    title: "portrait attempt",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 148,
    type: "sketch",
    date: "2025-12-10",
    title: "gesture study",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 149,
    type: "sketch",
    date: "2025-12-10",
    title: "gesture study 2",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 150,
    type: "music",
    date: "2025-12-12",
    title: "holiday sketch",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 151,
    type: "sketch",
    date: "2025-12-15",
    title: "building exterior",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 152,
    type: "animation",
    date: "2025-12-17",
    title: "snow particle test",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 153,
    type: "sketch",
    date: "2025-12-19",
    title: "year-end figure",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 154,
    type: "sketch",
    date: "2025-12-22",
    title: "holiday warmup",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 155,
    type: "sketch",
    date: "2026-01-02",
    title: "new year figure",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 156,
    type: "sketch",
    date: "2026-01-05",
    title: "resolution study",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 157,
    type: "reference",
    date: "2026-01-07",
    title: "cold light ref",
    hue: "110,96,80",
    tags: ["light"],
  },
  {
    id: 158,
    type: "sketch",
    date: "2026-01-09",
    title: "indoor figure",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 159,
    type: "sketch",
    date: "2026-01-09",
    title: "lamp study",
    hue: "140,116,100",
    tags: ["light", "interiors"],
  },
  {
    id: 160,
    type: "music",
    date: "2026-01-12",
    title: "new theme",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 161,
    type: "sketch",
    date: "2026-01-14",
    title: "anatomy review",
    hue: "176,120,72",
    tags: ["anatomy"],
  },
  {
    id: 162,
    type: "sketch",
    date: "2026-01-14",
    title: "skeleton ref",
    hue: "176,120,72",
    tags: ["anatomy"],
  },
  {
    id: 163,
    type: "sketch",
    date: "2026-01-17",
    title: "foreshortening 3",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 164,
    type: "animation",
    date: "2026-01-20",
    title: "idle loop v1",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 165,
    type: "sketch",
    date: "2026-01-22",
    title: "window study",
    hue: "140,116,100",
    tags: ["light"],
  },
  {
    id: 166,
    type: "sketch",
    date: "2026-01-24",
    title: "market scene",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 167,
    type: "sketch",
    date: "2026-01-27",
    title: "figure study",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 168,
    type: "reference",
    date: "2026-01-29",
    title: "lucian freud study",
    hue: "110,96,80",
    tags: ["masters", "figures"],
  },
];
const BASE_ITEMS = [
  {
    id: 1,
    type: "sketch",
    date: "2026-02-22",
    title: "figure study #5",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 2,
    type: "sketch",
    date: "2026-02-22",
    title: "hand gestures",
    hue: "160,108,64",
    tags: ["figures", "hands"],
  },
  {
    id: 3,
    type: "reference",
    date: "2026-02-22",
    title: "hopper ref",
    hue: "110,96,80",
    tags: ["light", "interiors"],
  },
  {
    id: 4,
    type: "sketch",
    date: "2026-02-20",
    title: "figure study #4",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 5,
    type: "sketch",
    date: "2026-02-20",
    title: "window study",
    hue: "140,116,100",
    tags: ["light", "interiors"],
  },
  {
    id: 6,
    type: "music",
    date: "2026-02-19",
    title: "chord idea 1",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 7,
    type: "reference",
    date: "2026-02-17",
    title: "rembrandt light",
    hue: "110,96,80",
    tags: ["light", "masters"],
  },
  {
    id: 8,
    type: "sketch",
    date: "2026-02-17",
    title: "figure study #3",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 9,
    type: "animation",
    date: "2026-02-14",
    title: "walk cycle rough",
    hue: "88,104,122",
    tags: ["motion"],
  },
  {
    id: 10,
    type: "sketch",
    date: "2026-02-14",
    title: "cafe scene",
    hue: "160,108,64",
    tags: ["interiors"],
  },
  {
    id: 11,
    type: "reference",
    date: "2026-02-11",
    title: "sargent study ref",
    hue: "110,96,80",
    tags: ["light", "masters"],
  },
  {
    id: 12,
    type: "sketch",
    date: "2026-02-11",
    title: "figure study #2",
    hue: "176,120,72",
    tags: ["figures"],
  },
  {
    id: 13,
    type: "sketch",
    date: "2026-02-11",
    title: "light through glass",
    hue: "140,116,100",
    tags: ["light", "interiors"],
  },
  {
    id: 14,
    type: "music",
    date: "2026-02-08",
    title: "melody fragment",
    hue: "90,118,88",
    tags: ["melody"],
  },
  {
    id: 15,
    type: "sketch",
    date: "2026-02-04",
    title: "figure study #1",
    hue: "176,120,72",
    tags: ["figures", "anatomy"],
  },
  {
    id: 16,
    type: "reference",
    date: "2026-02-04",
    title: "wyeth field ref",
    hue: "110,96,80",
    tags: ["masters"],
  },
  {
    id: 17,
    type: "sketch",
    date: "2026-02-01",
    title: "still life attempt",
    hue: "140,116,100",
    tags: ["interiors"],
  },
];
const INIT_ITEMS = [...EXTENDED_ITEMS, ...BASE_ITEMS];

const INIT_CANVASES = [
  {
    id: 1,
    name: "figure studies",
    color: "#a06830",
    note: "I keep coming back to figures. something about the weight of them lately.",
    itemIds: [1, 2, 4, 8, 12, 15],
    positions: {
      1: { x: 60, y: 80 },
      2: { x: 240, y: 55 },
      4: { x: 430, y: 70 },
      8: { x: 80, y: 320 },
      12: { x: 290, y: 300 },
      15: { x: 470, y: 290 },
    },
    notes: [
      {
        id: "n1",
        x: 340,
        y: 185,
        text: "something keeps pulling me toward the weight of the torso — not the face",
      },
      {
        id: "n2",
        x: 590,
        y: 95,
        text: "#4 and #5 feel related — same stance?",
      },
    ],
    edges: [
      { id: "e1", fromId: 4, toId: 1, label: "same stance?" },
      { id: "e2", fromId: 1, toId: 8, label: "weight shift" },
    ],
    strokes: [],
    references: [
      {
        id: "r1",
        filename: "michelangelo torso study",
        hue: "160,140,100",
        addedDate: "2026-02-18",
      },
      {
        id: "r2",
        filename: "giacometti standing figure",
        hue: "140,130,110",
        addedDate: "2026-02-15",
      },
    ],
  },
  {
    id: 2,
    name: "light + shadow",
    color: "#7a6858",
    note: "rembrandt ref keeps pulling me in. not sure what I'm looking for yet.",
    itemIds: [3, 7, 11, 13],
    positions: {
      3: { x: 60, y: 70 },
      7: { x: 270, y: 65 },
      11: { x: 490, y: 80 },
      13: { x: 165, y: 295 },
    },
    notes: [],
    edges: [{ id: "e3", fromId: 7, toId: 11, label: "same source?" }],
    strokes: [],
    references: [
      {
        id: "r4",
        filename: "vermeer window detail",
        hue: "110,120,100",
        addedDate: "2026-02-20",
      },
      {
        id: "r5",
        filename: "caravaggio shaft study",
        hue: "100,90,80",
        addedDate: "2026-02-14",
      },
    ],
  },
];

const TYPE_META = {
  sketch: { label: "sketch", icon: "✏", accent: "#a06830" },
  reference: { label: "ref", icon: "◎", accent: "#7a6858" },
  music: { label: "music", icon: "♪", accent: "#4a7858" },
  animation: { label: "anim", icon: "▷", accent: "#4a6078" },
};
const TYPE_HUE = {
  sketch: [176, 120, 72],
  reference: [110, 96, 80],
  music: [90, 118, 88],
  animation: [88, 104, 122],
};
const TAG_COLORS = [
  "#a06830",
  "#7a6858",
  "#4a7858",
  "#4a6078",
  "#8a6858",
  "#6a5878",
  "#7a7040",
  "#5a6848",
];
const CANVAS_PAL = [
  "#a06830",
  "#7a6858",
  "#4a7858",
  "#4a6078",
  "#8a6858",
  "#6a5878",
  "#7a7040",
];
const rg = (h, a) => `rgba(${h},${a})`;
const mono = "'Courier New',monospace";

function allDatesInRange(items) {
  const dates = items.map((i) => i.date).sort();
  if (!dates.length) return [];
  const out = [];
  for (
    let d = new Date(dates[dates.length - 1] + "T12:00:00");
    d >= new Date(dates[0] + "T12:00:00");
    d.setDate(d.getDate() - 1)
  )
    out.push(d.toISOString().slice(0, 10));
  return out;
}

function Waveform({ hue, bars = 18, maxH = 14 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 2,
            height: 4 + Math.abs(Math.sin(i * 0.72 + bars)) * maxH,
            background: `rgba(${hue},0.45)`,
            borderRadius: 1,
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function TagChip({ tag, color, onRemove }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: color ? color + "18" : "#f0ebe4",
        border: `1px solid ${color ? color + "55" : "#ddd5c8"}`,
        borderRadius: 20,
        padding: "2px 8px",
      }}
    >
      <span
        style={{ fontSize: 9, color: color || "#8a7a6a", fontFamily: mono }}
      >
        {tag}
      </span>
      {onRemove && (
        <span
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            fontSize: 10,
            color: color || "#b0a090",
            cursor: "pointer",
            lineHeight: 1,
            marginLeft: 1,
            fontFamily: mono,
          }}
        >
          ×
        </span>
      )}
    </div>
  );
}

function CanvasNote({
  note,
  onChange,
  onDelete,
  isEditing,
  onStartEdit,
  onEndEdit,
}) {
  const ta = useRef(null);
  useEffect(() => {
    if (isEditing && ta.current) {
      ta.current.focus();
      ta.current.selectionStart = ta.current.value.length;
    }
  }, [isEditing]);
  useEffect(() => {
    if (ta.current) {
      ta.current.style.height = "auto";
      ta.current.style.height = ta.current.scrollHeight + "px";
    }
  }, [note.text, isEditing]);
  const empty = !note.text.trim();
  return (
    <div style={{ width: 210, fontFamily: mono }}>
      <div
        style={{
          background: "#fdf8ee",
          border: "1px solid #e8dfc0",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 6,
            background: "#f0e8c8",
            borderBottom: "1px solid #e8dfc0",
          }}
        />
        <div
          style={{ padding: "9px 10px 5px" }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isEditing) onStartEdit();
          }}
        >
          {isEditing ? (
            <textarea
              ref={ta}
              value={note.text}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() => {
                if (empty) onDelete();
                else onEndEdit();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (empty) onDelete();
                  else onEndEdit();
                }
              }}
              placeholder="write a note..."
              style={{
                width: "100%",
                background: "none",
                border: "none",
                outline: "none",
                resize: "none",
                overflow: "hidden",
                minHeight: 38,
                fontSize: 11,
                color: "#352a1e",
                lineHeight: 1.75,
                padding: 0,
                fontFamily: mono,
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 11,
                color: empty ? "#c8bfb0" : "#352a1e",
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                minHeight: 38,
                cursor: "text",
                fontStyle: empty ? "italic" : "normal",
              }}
            >
              {empty ? "write a note..." : note.text}
            </div>
          )}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "3px 8px 6px",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 9,
              color: "#c0b090",
              padding: "2px 4px",
              lineHeight: 1,
              fontFamily: mono,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#a06830")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#c0b090")}
          >
            delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RefCard({ refItem, onRemove }) {
  return (
    <div
      style={{
        width: "100%",
        borderRadius: 3,
        overflow: "hidden",
        border: "1px solid #ddd5c4",
        background: "#faf7f0",
        marginBottom: 10,
      }}
    >
      <div
        style={{
          aspectRatio: "4/3",
          background: `linear-gradient(148deg,${rg(refItem.hue, 0.14)},${rg(refItem.hue, 0.3)})`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `repeating-linear-gradient(-45deg,${rg(refItem.hue, 0.05)} 0px,${rg(refItem.hue, 0.05)} 1px,transparent 1px,transparent 8px)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 5,
            left: 5,
            background: "rgba(255,255,255,0.86)",
            borderRadius: 20,
            padding: "2px 7px",
            fontSize: 8,
            color: "#7a6858",
            fontFamily: mono,
          }}
        >
          ◎ ref
        </div>
        <button
          onClick={onRemove}
          style={{
            position: "absolute",
            top: 5,
            right: 5,
            background: "rgba(255,255,255,0.82)",
            border: "none",
            borderRadius: "50%",
            width: 18,
            height: 18,
            cursor: "pointer",
            fontSize: 11,
            color: "#a09080",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: mono,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#a06830")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#a09080")}
        >
          ×
        </button>
      </div>
      <div style={{ padding: "6px 8px 7px" }}>
        <div
          style={{
            fontSize: 9,
            color: "#4a3a28",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontFamily: mono,
          }}
        >
          {refItem.filename}
        </div>
        <div
          style={{
            fontSize: 8,
            color: "#b0a090",
            marginTop: 1,
            fontFamily: mono,
          }}
        >
          added {refItem.addedDate}
        </div>
      </div>
    </div>
  );
}

function RefDropZone({ onAdd }) {
  const [h, setH] = useState(false);
  const r = useRef(null);
  return (
    <div
      style={{
        border: `1.5px dashed ${h ? "#a06830" : "#d8d0c0"}`,
        borderRadius: 3,
        padding: "14px 10px",
        textAlign: "center",
        cursor: "pointer",
        background: h ? "#fff9f2" : "transparent",
        transition: "all 0.15s",
        marginBottom: 12,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setH(true);
      }}
      onDragLeave={() => setH(false)}
      onDrop={(e) => {
        e.preventDefault();
        setH(false);
        onAdd(e.dataTransfer.files);
      }}
      onClick={() => r.current?.click()}
    >
      <div style={{ fontSize: 18, marginBottom: 5, opacity: h ? 0.9 : 0.4 }}>
        ⊕
      </div>
      <div
        style={{
          fontSize: 9,
          color: h ? "#a06830" : "#b0a090",
          lineHeight: 1.7,
          fontFamily: mono,
        }}
      >
        drop images here
        <br />
        or click to browse
      </div>
      <input
        ref={r}
        type="file"
        multiple
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onAdd(e.target.files)}
      />
    </div>
  );
}

function LongView({ items, canvases, tagColors }) {
  const [hoveredDate, setHoveredDate] = useState(null);
  const [popoverPos, setPopoverPos] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState(null);
  const [filterType, setFilterType] = useState(null);
  const containerRef = useRef(null);

  const byDate = useMemo(() => {
    const m = {};
    items.forEach((i) => {
      if (!m[i.date]) m[i.date] = [];
      m[i.date].push(i);
    });
    return m;
  }, [items]);

  const { weeks, monthLabels } = useMemo(() => {
    const all = items.map((i) => i.date).sort();
    if (!all.length) return { weeks: [], monthLabels: [] };
    const sd = new Date(all[0] + "T12:00:00"),
      ed = new Date(all[all.length - 1] + "T12:00:00");
    const start = new Date(sd.getFullYear(), sd.getMonth(), 1),
      end = new Date(ed.getFullYear(), ed.getMonth() + 1, 0);
    const weeks = [],
      MON = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
    const d = new Date(start);
    const dow = d.getDay();
    d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
    while (d <= end) {
      const w = [];
      for (let i = 0; i < 7; i++) {
        const iso = d.toISOString().slice(0, 10);
        w.push({ date: iso, inRange: d >= start && d <= end });
        d.setDate(d.getDate() + 1);
      }
      weeks.push(w);
    }
    const labels = [];
    weeks.forEach((w, wi) =>
      w.forEach(({ date }) => {
        const dd = new Date(date + "T12:00:00");
        if (dd.getDate() <= 7) {
          const k = `${dd.getFullYear()}-${dd.getMonth()}`;
          if (!labels.find((l) => l.key === k))
            labels.push({ key: k, label: `${MON[dd.getMonth()]}`, col: wi });
        }
      }),
    );
    return { weeks, monthLabels: labels };
  }, [items]);

  const allTags = useMemo(() => {
    const s = new Set();
    items.forEach((i) => (i.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [items]);
  const matchesFilter = (date) => {
    if (!activeFilter) return true;
    const di = byDate[date] || [];
    if (!di.length) return false;
    if (filterType === "canvas") {
      const c = canvases.find((c) => c.id === activeFilter);
      return c && di.some((i) => c.itemIds.includes(i.id));
    }
    if (filterType === "tag")
      return di.some((i) => (i.tags || []).includes(activeFilter));
    return true;
  };
  const cellStyle = (date) => {
    const di = byDate[date] || [],
      count = di.length;
    const faded = activeFilter && !matchesFilter(date);
    if (count === 0)
      return {
        background: faded ? "#f3efea" : "#ede8e0",
        border: "1px solid #e4ddd4",
      };
    const tc = { sketch: 0, reference: 0, music: 0, animation: 0 };
    di.forEach((i) => (tc[i.type] = (tc[i.type] || 0) + 1));
    let rv = 0,
      g = 0,
      b = 0;
    Object.entries(tc).forEach(([t, n]) => {
      if (n && TYPE_HUE[t]) {
        rv += TYPE_HUE[t][0] * n;
        g += TYPE_HUE[t][1] * n;
        b += TYPE_HUE[t][2] * n;
      }
    });
    rv = Math.round(rv / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    const alpha = faded ? 0.08 : 0.15 + (Math.min(count, 4) / 4) * 0.55;
    return {
      background: `rgba(${rv},${g},${b},${alpha})`,
      border: `1px solid rgba(${rv},${g},${b},${faded ? 0.1 : 0.35})`,
    };
  };
  const canvasDots = (date) => {
    const ids = new Set((byDate[date] || []).map((i) => i.id));
    return canvases.filter((c) => c.itemIds.some((id) => ids.has(id)));
  };
  const CELL = 13,
    GAP = 2,
    DAYS = ["M", "", "W", "", "F", "", "S"];
  const toggleFilter = (type, id) => {
    if (filterType === type && activeFilter === id) {
      setActiveFilter(null);
      setFilterType(null);
    } else {
      setActiveFilter(id);
      setFilterType(type);
    }
  };
  const hoveredItems = (hoveredDate && byDate[hoveredDate]) || [];
  const activeDays = Object.keys(byDate).length;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "#fdfaf7",
        fontFamily: mono,
      }}
    >
      <div
        style={{ padding: "28px 32px 40px", position: "relative" }}
        ref={containerRef}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 24,
            marginBottom: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 12,
                color: "#352a1e",
                letterSpacing: "0.1em",
                marginBottom: 3,
              }}
            >
              LONG VIEW
            </div>
            <div style={{ fontSize: 9, color: "#b0a090" }}>
              {items.length} items · {activeDays} active days
            </div>
          </div>
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {canvases.map((c) => (
              <button
                key={c.id}
                onClick={() => toggleFilter("canvas", c.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background:
                    filterType === "canvas" && activeFilter === c.id
                      ? c.color + "18"
                      : "none",
                  border: `1px solid ${filterType === "canvas" && activeFilter === c.id ? c.color + "88" : "#e0d8d0"}`,
                  borderRadius: 20,
                  padding: "3px 9px",
                  cursor: "pointer",
                  fontSize: 9,
                  color:
                    filterType === "canvas" && activeFilter === c.id
                      ? c.color
                      : "#a09080",
                  fontFamily: mono,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: c.color,
                  }}
                />
                {c.name}
              </button>
            ))}
            {allTags.map((t) => (
              <button
                key={t}
                onClick={() => toggleFilter("tag", t)}
                style={{
                  background:
                    filterType === "tag" && activeFilter === t
                      ? tagColors[t] + "18"
                      : "none",
                  border: `1px solid ${filterType === "tag" && activeFilter === t ? tagColors[t] + "88" : "#e0d8d0"}`,
                  borderRadius: 20,
                  padding: "3px 9px",
                  cursor: "pointer",
                  fontSize: 9,
                  color:
                    filterType === "tag" && activeFilter === t
                      ? tagColors[t]
                      : "#a09080",
                  fontFamily: mono,
                }}
              >
                #{t}
              </button>
            ))}
            {activeFilter && (
              <button
                onClick={() => {
                  setActiveFilter(null);
                  setFilterType(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#b0a090",
                  cursor: "pointer",
                  fontSize: 9,
                  fontFamily: mono,
                }}
              >
                clear ×
              </button>
            )}
          </div>
        </div>

        <div style={{ overflowX: "auto", paddingBottom: 8 }}>
          <div
            style={{
              display: "flex",
              gap: GAP,
              marginBottom: 4,
              paddingLeft: 18,
            }}
          >
            {weeks.map((w, wi) => {
              const label = monthLabels.find((l) => l.col === wi);
              return (
                <div
                  key={wi}
                  style={{
                    width: CELL,
                    flexShrink: 0,
                    fontSize: 8,
                    color: "#b0a090",
                    whiteSpace: "nowrap",
                    lineHeight: 1,
                  }}
                >
                  {label ? label.label : ""}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: GAP }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: GAP,
                marginRight: 2,
                flexShrink: 0,
              }}
            >
              {DAYS.map((d, i) => (
                <div
                  key={i}
                  style={{
                    height: CELL,
                    fontSize: 8,
                    color: d ? "#c0b0a0" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    width: 14,
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: GAP,
                  flexShrink: 0,
                }}
              >
                {week.map(({ date, inRange }, di) => {
                  const count = (byDate[date] || []).length;
                  const dots = inRange ? canvasDots(date) : [];
                  const isH = hoveredDate === date;
                  const cs = inRange
                    ? cellStyle(date)
                    : {
                        background: "transparent",
                        border: "1px solid transparent",
                      };
                  return (
                    <div
                      key={di}
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 2,
                        ...cs,
                        cursor: inRange && count > 0 ? "pointer" : "default",
                        position: "relative",
                        transition: "transform 0.08s",
                        transform: isH && count > 0 ? "scale(1.4)" : "scale(1)",
                        zIndex: isH ? 10 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!count || !inRange) return;
                        const r = e.currentTarget.getBoundingClientRect();
                        const cr =
                          containerRef.current?.getBoundingClientRect() || {
                            left: 0,
                            top: 0,
                          };
                        setHoveredDate(date);
                        setPopoverPos({
                          x: r.left - cr.left + r.width / 2,
                          y: r.top - cr.top,
                        });
                      }}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      {inRange && dots.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: 1,
                            left: 1,
                            right: 1,
                            display: "flex",
                            gap: 1,
                            justifyContent: "center",
                          }}
                        >
                          {dots.slice(0, 3).map((c) => (
                            <div
                              key={c.id}
                              style={{
                                width: 2,
                                height: 2,
                                borderRadius: "50%",
                                background: c.color,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 20,
            marginTop: 20,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 8, color: "#c0b0a0" }}>less</span>
            {[0, 1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background:
                    n === 0 ? "#ede8e0" : `rgba(176,120,72,${0.15 + n * 0.17})`,
                  border: `1px solid ${n === 0 ? "#e4ddd4" : `rgba(176,120,72,${0.25 + n * 0.15})`}`,
                }}
              />
            ))}
            <span style={{ fontSize: 8, color: "#c0b0a0" }}>more</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {Object.entries(TYPE_META).map(([t, m]) => (
              <div
                key={t}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 1,
                    background: `rgba(${TYPE_HUE[t].join(",")},0.5)`,
                  }}
                />
                <span style={{ fontSize: 8, color: "#b0a090" }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>

        {hoveredDate && hoveredItems.length > 0 && (
          <div
            style={{
              position: "absolute",
              left: Math.max(
                8,
                Math.min(
                  popoverPos.x - 120,
                  (containerRef.current?.offsetWidth || 600) - 250,
                ),
              ),
              top: popoverPos.y - 8,
              transform: "translateY(-100%)",
              background: "#fdfaf7",
              border: "1px solid #e0d8cc",
              borderRadius: 4,
              boxShadow: "0 4px 20px rgba(0,0,0,0.13)",
              padding: "10px 12px",
              width: 240,
              zIndex: 100,
              pointerEvents: "none",
              fontFamily: mono,
            }}
          >
            <div style={{ fontSize: 10, color: "#352a1e", marginBottom: 8 }}>
              {new Date(hoveredDate + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "long",
                day: "numeric",
              })}
              <span style={{ marginLeft: 8, color: "#b0a090" }}>
                — {hoveredItems.length} item
                {hoveredItems.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {hoveredItems.slice(0, 8).map((item) => {
                const isM = item.type === "music";
                return (
                  <div
                    key={item.id}
                    style={{
                      width: 46,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: isM ? 22 : 56,
                        borderRadius: 2,
                        background: isM
                          ? "#f0ebe3"
                          : `linear-gradient(148deg,${rg(item.hue, 0.2)},${rg(item.hue, 0.4)})`,
                        border: "1px solid rgba(0,0,0,0.08)",
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {!isM && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: `repeating-linear-gradient(-45deg,${rg(item.hue, 0.06)} 0px,${rg(item.hue, 0.06)} 1px,transparent 1px,transparent 6px)`,
                          }}
                        />
                      )}
                      {isM && <Waveform hue={item.hue} bars={8} maxH={7} />}
                      <div
                        style={{
                          position: "absolute",
                          top: 2,
                          left: 2,
                          fontSize: 7,
                          color: TYPE_META[item.type].accent,
                          background: "rgba(255,255,255,0.88)",
                          borderRadius: 8,
                          padding: "1px 3px",
                        }}
                      >
                        {TYPE_META[item.type].icon}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 7,
                        color: "#6a5a4a",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </div>
                  </div>
                );
              })}
            </div>
            {canvasDots(hoveredDate).length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  marginTop: 7,
                  flexWrap: "wrap",
                }}
              >
                {canvasDots(hoveredDate).map((c) => (
                  <div
                    key={c.id}
                    style={{ display: "flex", alignItems: "center", gap: 3 }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: c.color,
                      }}
                    />
                    <span style={{ fontSize: 8, color: c.color }}>
                      {c.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasView({
  canvas,
  allItems,
  canvases,
  setCanvases,
  selectedIds,
  onItemClick,
  onCanvasClick,
  onOpenCanvas,
}) {
  const surfaceRef = useRef(null);
  const off = useRef({ x: 0, y: 0 });
  const [drag, setDrag] = useState(null);
  const [moved, setMoved] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [penMode, setPenMode] = useState(false);
  const [currentStroke, setCurrentStroke] = useState(null);
  const [drawingEdge, setDrawingEdge] = useState(null);
  const [edgeLabelId, setEdgeLabelId] = useState(null);
  const [hoverItemId, setHoverItemId] = useState(null);

  const updateCanvas = useCallback(
    (fn) => {
      if (!canvas) return;
      setCanvases((prev) => prev.map((c) => (c.id === canvas.id ? fn(c) : c)));
    },
    [canvas, setCanvases],
  );

  useEffect(() => {
    const mm = (e) => {
      if (penMode && currentStroke) {
        const r = surfaceRef.current?.getBoundingClientRect();
        if (!r) return;
        setCurrentStroke((s) =>
          s
            ? {
                ...s,
                points: [
                  ...s.points,
                  `${e.clientX - r.left + surfaceRef.current.scrollLeft},${e.clientY - r.top + surfaceRef.current.scrollTop}`,
                ],
              }
            : s,
        );
        return;
      }
      if (drawingEdge) {
        const r = surfaceRef.current?.getBoundingClientRect();
        if (!r) return;
        setDrawingEdge((s) =>
          s
            ? {
                ...s,
                x: e.clientX - r.left + surfaceRef.current.scrollLeft,
                y: e.clientY - r.top + surfaceRef.current.scrollTop,
              }
            : s,
        );
        return;
      }
      if (!drag) return;
      setMoved(true);
      const r = surfaceRef.current?.getBoundingClientRect();
      if (!r) return;
      const nx =
        e.clientX - r.left + surfaceRef.current.scrollLeft - off.current.x;
      const ny =
        e.clientY - r.top + surfaceRef.current.scrollTop - off.current.y;
      if (drag.type === "item")
        updateCanvas((c) => ({
          ...c,
          positions: { ...c.positions, [drag.id]: { x: nx, y: ny } },
        }));
      else if (drag.type === "note")
        updateCanvas((c) => ({
          ...c,
          notes: (c.notes || []).map((n) =>
            n.id === drag.id ? { ...n, x: nx, y: ny } : n,
          ),
        }));
    };
    const mu = (e) => {
      if (penMode && currentStroke) {
        if (currentStroke.points.length > 2) {
          const path =
            "M " +
            currentStroke.points[0] +
            " L " +
            currentStroke.points.slice(1).join(" L ");
          updateCanvas((c) => ({
            ...c,
            strokes: [
              ...(c.strokes || []),
              { id: "s" + Date.now(), path, color: canvas?.color || "#a06830" },
            ],
          }));
        }
        setCurrentStroke(null);
        return;
      }
      if (drawingEdge) {
        setDrawingEdge(null);
        return;
      }
      setDrag(null);
      setMoved(false);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
  }, [drag, penMode, currentStroke, drawingEdge, canvas, updateCanvas]);

  if (!canvas)
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "#eee9e1",
          backgroundImage: "radial-gradient(#d8d0c6 1px,transparent 1px)",
          backgroundSize: "24px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: mono,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 320, padding: "0 24px" }}>
          <div
            style={{
              fontSize: 13,
              color: "#b0a098",
              letterSpacing: "0.04em",
              marginBottom: 12,
            }}
          >
            no canvas open
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#c8c0b4",
              lineHeight: 1.9,
              marginBottom: 16,
            }}
          >
            open a canvas from the sidebar, or create a new one.
          </div>
          <button
            onClick={onOpenCanvas}
            style={{
              background: "#a06830",
              border: "none",
              color: "#fff",
              fontSize: 10,
              padding: "7px 16px",
              cursor: "pointer",
              borderRadius: 2,
              fontFamily: mono,
            }}
          >
            + new canvas
          </button>
        </div>
      </div>
    );

  const items = allItems.filter((i) => canvas.itemIds.includes(i.id));
  const notes = canvas.notes || [],
    edges = canvas.edges || [],
    strokes = canvas.strokes || [],
    refs = canvas.references || [];
  const getPos = (id) => {
    const p = canvas.positions?.[id];
    return p || { x: 60 + (id % 5) * 175, y: 60 + Math.floor(id / 5) * 220 };
  };
  const edgeCoords = (fId, tId) => {
    const fp = getPos(fId),
      tp = getPos(tId);
    const fx = fp.x + 74,
      fy = fp.y + 95,
      tx = tp.x + 74,
      ty = tp.y + 95;
    return {
      x1: fx,
      y1: fy,
      x2: tx,
      y2: ty,
      mx: (fx + tx) / 2,
      my: (fy + ty) / 2,
    };
  };

  const addNote = () => {
    const el = surfaceRef.current;
    const nn = {
      id: "n" + Date.now(),
      x: el ? el.scrollLeft + el.clientWidth * 0.35 - 105 : 220,
      y: el ? el.scrollTop + el.clientHeight / 2 - 60 : 200,
      text: "",
    };
    updateCanvas((c) => ({ ...c, notes: [...(c.notes || []), nn] }));
    setEditingNoteId(nn.id);
  };
  const addRef = (files) => {
    const nr = Array.from(files).map((f, i) => ({
      id: "r" + Date.now() + i,
      filename: f.name.replace(/\.[^.]+$/, ""),
      hue: `${130 + Math.floor(Math.random() * 40)},${120 + Math.floor(Math.random() * 30)},${100 + Math.floor(Math.random() * 20)}`,
      addedDate: new Date().toISOString().slice(0, 10),
    }));
    updateCanvas((c) => ({
      ...c,
      references: [...(c.references || []), ...nr],
    }));
  };

  const onItemMD = (e, id) => {
    if (penMode) return;
    if (e.shiftKey) {
      e.stopPropagation();
      const pos = getPos(id);
      setDrawingEdge({
        fromId: id,
        x: pos.x + 74,
        y: pos.y + 95,
        startX: pos.x + 74,
        startY: pos.y + 95,
      });
      return;
    }
    e.stopPropagation();
    const r = surfaceRef.current.getBoundingClientRect();
    const pos = getPos(id);
    off.current = {
      x: e.clientX - r.left + surfaceRef.current.scrollLeft - pos.x,
      y: e.clientY - r.top + surfaceRef.current.scrollTop - pos.y,
    };
    setDrag({ type: "item", id });
    setMoved(false);
  };
  const onItemMU = (e, id) => {
    if (drawingEdge && drawingEdge.fromId !== id) {
      const eid = "e" + Date.now();
      updateCanvas((c) => ({
        ...c,
        edges: [
          ...(c.edges || []),
          { id: eid, fromId: drawingEdge.fromId, toId: id, label: "" },
        ],
      }));
      setDrawingEdge(null);
      setTimeout(() => setEdgeLabelId(eid), 50);
    }
  };
  const onSurfMD = (e) => {
    const el = surfaceRef.current;
    if (
      e.target === el ||
      e.target.tagName === "svg" ||
      e.target.tagName === "path" ||
      e.target.tagName === "line"
    ) {
      if (penMode) {
        const r = el.getBoundingClientRect();
        setCurrentStroke({
          points: [
            `${e.clientX - r.left + el.scrollLeft},${e.clientY - r.top + el.scrollTop}`,
          ],
        });
        return;
      }
      setEditingNoteId(null);
      onCanvasClick();
    }
  };
  const onSurfDrop = (e) => {
    e.preventDefault();
    const idStr = e.dataTransfer.getData("text/folio-item");
    if (!idStr) return;
    const id = parseInt(idStr);
    if (!canvas.itemIds.includes(id)) {
      const r = surfaceRef.current.getBoundingClientRect();
      updateCanvas((c) => ({
        ...c,
        itemIds: [...c.itemIds, id],
        positions: {
          ...c.positions,
          [id]: {
            x: Math.max(
              0,
              e.clientX - r.left + surfaceRef.current.scrollLeft - 74,
            ),
            y: Math.max(
              0,
              e.clientY - r.top + surfaceRef.current.scrollTop - 95,
            ),
          },
        },
      }));
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: mono,
      }}
    >
      <div
        style={{
          height: 38,
          flexShrink: 0,
          background: "rgba(238,233,225,0.97)",
          borderBottom: "1px solid #ddd6cc",
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 10,
          zIndex: 20,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: canvas.color,
            flexShrink: 0,
          }}
        />
        <span
          style={{ fontSize: 10, color: canvas.color, letterSpacing: "0.06em" }}
        >
          {canvas.name}
        </span>
        <span style={{ fontSize: 9, color: "#b8b0a4" }}>
          {items.length} items · {notes.length} notes · {edges.length}{" "}
          connections
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => {
            setPenMode((p) => !p);
            setDrawingEdge(null);
          }}
          style={{
            background: penMode ? canvas.color + "22" : "none",
            border: `1px solid ${penMode ? canvas.color : "#d8d0c8"}`,
            borderRadius: 2,
            padding: "4px 10px",
            cursor: "pointer",
            fontSize: 11,
            color: penMode ? canvas.color : "#8a7a6a",
            fontFamily: mono,
          }}
        >
          ✒
        </button>
        <span style={{ fontSize: 8, color: "#c0b0a0" }}>
          {penMode ? "drawing" : "⇧ drag to connect"}
        </span>
        <button
          onClick={addNote}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "#fdf8ee",
            border: "1px solid #e0d8b8",
            borderRadius: 2,
            padding: "5px 11px",
            cursor: "pointer",
            fontSize: 10,
            color: "#7a6040",
            fontFamily: mono,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f8f0d8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "#fdf8ee")}
        >
          + note
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div
          ref={surfaceRef}
          onMouseDown={onSurfMD}
          onDragOver={(e) => e.preventDefault()}
          onDrop={onSurfDrop}
          style={{
            flex: 1,
            overflow: "auto",
            background: "#eee9e1",
            backgroundImage: "radial-gradient(#d8d0c6 1px,transparent 1px)",
            backgroundSize: "24px 24px",
            position: "relative",
            cursor: penMode ? "crosshair" : "default",
          }}
        >
          <div style={{ width: 2400, height: 1800, position: "relative" }}>
            <svg
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 5,
              }}
              overflow="visible"
            >
              {strokes.map((s) => (
                <path
                  key={s.id}
                  d={s.path}
                  stroke={s.color}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              ))}
              {currentStroke && currentStroke.points.length > 1 && (
                <path
                  d={
                    "M " +
                    currentStroke.points[0] +
                    " L " +
                    currentStroke.points.slice(1).join(" L ")
                  }
                  stroke={canvas.color}
                  strokeWidth="2"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.7"
                />
              )}
              {edges.map((edge) => {
                const { x1, y1, x2, y2, mx, my } = edgeCoords(
                  edge.fromId,
                  edge.toId,
                );
                const dx = x2 - x1,
                  dy = y2 - y1;
                const cx = mx - dy * 0.2,
                  cy = my + dx * 0.2;
                return (
                  <g
                    key={edge.id}
                    style={{ pointerEvents: "all", cursor: "pointer" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateCanvas((c) => ({
                        ...c,
                        edges: (c.edges || []).filter(
                          (ed) => ed.id !== edge.id,
                        ),
                      }));
                    }}
                  >
                    <path
                      d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                      stroke={canvas.color}
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.5"
                      strokeDasharray="5,3"
                    />
                    <circle cx={mx} cy={my} r="8" fill="transparent" />
                    {edge.label && (
                      <text
                        x={cx}
                        y={cy - 6}
                        textAnchor="middle"
                        fontSize="9"
                        fill={canvas.color}
                        fontFamily={mono}
                        opacity="0.9"
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {drawingEdge && (
                <line
                  x1={drawingEdge.startX}
                  y1={drawingEdge.startY}
                  x2={drawingEdge.x}
                  y2={drawingEdge.y}
                  stroke={canvas.color}
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                  opacity="0.6"
                />
              )}
            </svg>

            {items.map((item) => {
              const meta = TYPE_META[item.type],
                isM = item.type === "music";
              const pos = getPos(item.id),
                sel = selectedIds.includes(item.id);
              const isEdgeTarget =
                drawingEdge &&
                hoverItemId === item.id &&
                drawingEdge.fromId !== item.id;
              return (
                <div
                  key={item.id}
                  style={{
                    position: "absolute",
                    left: pos.x,
                    top: pos.y,
                    width: 148,
                    height: isM ? 76 : 190,
                    zIndex: sel ? 100 : drag?.id === item.id ? 99 : 10,
                    cursor: penMode
                      ? "crosshair"
                      : drawingEdge
                        ? "crosshair"
                        : drag?.id === item.id
                          ? "grabbing"
                          : "grab",
                    userSelect: "none",
                  }}
                  onMouseDown={(e) => onItemMD(e, item.id)}
                  onMouseUp={(e) => onItemMU(e, item.id)}
                  onMouseEnter={() => setHoverItemId(item.id)}
                  onMouseLeave={() => setHoverItemId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!moved && !penMode && !drawingEdge)
                      onItemClick(e, item.id);
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: 3,
                      overflow: "hidden",
                      border: isEdgeTarget
                        ? `2px solid ${canvas.color}`
                        : sel
                          ? `2px solid ${meta.accent}`
                          : "1px solid #d4ccc4",
                      boxShadow: isEdgeTarget
                        ? `0 0 0 3px ${canvas.color}44`
                        : drag?.id === item.id
                          ? "0 10px 30px rgba(0,0,0,0.2)"
                          : "0 2px 8px rgba(0,0,0,0.1)",
                      background: isM
                        ? "#f0ebe3"
                        : `linear-gradient(148deg,${rg(item.hue, 0.17)},${rg(item.hue, 0.35)})`,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        position: "relative",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {!isM && (
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundImage: `repeating-linear-gradient(-45deg,${rg(item.hue, 0.05)} 0px,${rg(item.hue, 0.05)} 1px,transparent 1px,transparent 8px)`,
                          }}
                        />
                      )}
                      {isM && <Waveform hue={item.hue} bars={18} maxH={14} />}
                      <div
                        style={{
                          position: "absolute",
                          top: 5,
                          left: 5,
                          background: "rgba(255,255,255,0.86)",
                          borderRadius: 20,
                          padding: "2px 6px",
                          fontSize: 8,
                          color: meta.accent,
                          fontFamily: mono,
                        }}
                      >
                        {meta.icon}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "5px 8px 6px",
                        background: "rgba(255,255,255,0.9)",
                        borderTop: "1px solid rgba(0,0,0,0.06)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          color: "#352a1e",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          fontFamily: mono,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: 8,
                          color: "#b0a090",
                          marginTop: 1,
                          fontFamily: mono,
                        }}
                      >
                        {item.date}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {notes.map((note) => (
              <div
                key={note.id}
                style={{
                  position: "absolute",
                  left: note.x,
                  top: note.y,
                  zIndex: editingNoteId === note.id ? 200 : 50,
                }}
                onMouseDown={(e) => {
                  if (editingNoteId === note.id || penMode) return;
                  e.stopPropagation();
                  const r = surfaceRef.current.getBoundingClientRect();
                  off.current = {
                    x:
                      e.clientX -
                      r.left +
                      surfaceRef.current.scrollLeft -
                      note.x,
                    y:
                      e.clientY - r.top + surfaceRef.current.scrollTop - note.y,
                  };
                  setDrag({ type: "note", id: note.id });
                  setMoved(false);
                }}
              >
                <CanvasNote
                  note={note}
                  isEditing={editingNoteId === note.id}
                  onStartEdit={() => {
                    if (!moved) setEditingNoteId(note.id);
                  }}
                  onEndEdit={() => setEditingNoteId(null)}
                  onChange={(text) =>
                    updateCanvas((c) => ({
                      ...c,
                      notes: (c.notes || []).map((n) =>
                        n.id === note.id ? { ...n, text } : n,
                      ),
                    }))
                  }
                  onDelete={() => {
                    updateCanvas((c) => ({
                      ...c,
                      notes: (c.notes || []).filter((n) => n.id !== note.id),
                    }));
                    setEditingNoteId(null);
                  }}
                />
              </div>
            ))}

            {edgeLabelId &&
              (() => {
                const edge = edges.find((ed) => ed.id === edgeLabelId);
                if (!edge) return null;
                const { mx, my } = edgeCoords(edge.fromId, edge.toId);
                const save = (v) => {
                  updateCanvas((c) => ({
                    ...c,
                    edges: (c.edges || []).map((ed) =>
                      ed.id === edgeLabelId ? { ...ed, label: v } : ed,
                    ),
                  }));
                  setEdgeLabelId(null);
                };
                return (
                  <div
                    key="elabel"
                    style={{
                      position: "absolute",
                      left: mx - 60,
                      top: my - 14,
                      zIndex: 300,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      defaultValue={edge.label || ""}
                      placeholder="label..."
                      onBlur={(e) => save(e.target.value.trim())}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === "Escape")
                          save(e.target.value.trim());
                      }}
                      style={{
                        width: 120,
                        background: "#fdfaf7",
                        border: `1px solid ${canvas.color}`,
                        borderRadius: 2,
                        padding: "3px 7px",
                        fontSize: 9,
                        color: "#352a1e",
                        outline: "none",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
                        fontFamily: mono,
                      }}
                    />
                  </div>
                );
              })()}
          </div>
        </div>

        <div
          style={{
            width: 192,
            flexShrink: 0,
            background: "#f7f3ec",
            borderLeft: "1px solid #ddd5c4",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: mono,
          }}
        >
          <div
            style={{
              padding: "10px 12px 8px",
              borderBottom: "1px solid #e8e0d0",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: "#8a7a6a",
                letterSpacing: "0.12em",
                flex: 1,
              }}
            >
              REFERENCES
            </span>
            <span style={{ fontSize: 8, color: "#c0b0a0" }}>{refs.length}</span>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 0" }}>
            <RefDropZone onAdd={addRef} />
            <button
              onClick={() => addRef([{ name: "ref-" + Date.now() + ".jpg" }])}
              style={{
                width: "100%",
                marginBottom: 10,
                background: "none",
                border: "1px solid #e0d8cc",
                borderRadius: 2,
                padding: "5px 0",
                fontSize: 9,
                color: "#b0a090",
                cursor: "pointer",
                fontFamily: mono,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#a06830";
                e.currentTarget.style.color = "#a06830";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#e0d8cc";
                e.currentTarget.style.color = "#b0a090";
              }}
            >
              + simulate ref
            </button>
            {refs.length === 0 && (
              <div
                style={{
                  fontSize: 9,
                  color: "#c8c0b4",
                  fontStyle: "italic",
                  textAlign: "center",
                  paddingTop: 4,
                }}
              >
                no references yet
              </div>
            )}
            {refs.map((r) => (
              <RefCard
                key={r.id}
                refItem={r}
                onRemove={() =>
                  updateCanvas((c) => ({
                    ...c,
                    references: (c.references || []).filter(
                      (rf) => rf.id !== r.id,
                    ),
                  }))
                }
              />
            ))}
          </div>
          <div
            style={{
              padding: "8px 10px",
              borderTop: "1px solid #e8e0d0",
              flexShrink: 0,
              fontSize: 8,
              color: "#c0b0a0",
              lineHeight: 1.6,
            }}
          >
            ~/Folio/references/
            <br />
            <span style={{ color: canvas.color, opacity: 0.8 }}>
              {canvas.name.replace(/\s+/g, "-")}/
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StripView({
  allDates,
  byDate,
  selectedIds,
  canvases,
  onItemClick,
  onDrop,
  openCanvasId,
}) {
  const [dragOver, setDragOver] = useState(false);
  const gc = (id) => canvases.filter((c) => c.itemIds.includes(id));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "#fdfaf7",
        fontFamily: mono,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(e.dataTransfer.files);
      }}
    >
      {dragOver && (
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "#fff9f0",
            borderBottom: "2px solid #c8a870",
            padding: "10px 22px",
            fontSize: 10,
            color: "#a06830",
          }}
        >
          ⊕ drop to add to today
        </div>
      )}
      {openCanvasId && (
        <div
          style={{
            padding: "6px 22px",
            background: "#fdf8f0",
            borderBottom: "1px solid #f0e0c0",
            fontSize: 9,
            color: "#a06830",
          }}
        >
          drag items onto the canvas →
        </div>
      )}
      {allDates.map((date) => {
        const day = byDate[date] || [],
          empty = day.length === 0;
        const d = new Date(date + "T12:00:00");
        return (
          <div
            key={date}
            style={{
              display: "flex",
              borderBottom: "1px solid #f0ebe2",
              background: empty ? "#faf7f2" : "#fdfaf7",
              minHeight: empty ? 34 : "auto",
            }}
          >
            <div
              style={{
                width: 106,
                flexShrink: 0,
                padding: empty ? "7px 14px 7px 22px" : "12px 14px 12px 22px",
                borderRight: "1px solid #f0ebe2",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: empty ? "#c8bfb4" : "#352a1e",
                  fontWeight: empty ? 400 : 600,
                }}
              >
                {d.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: empty ? "#d0c8be" : "#c0b5a8",
                  marginTop: 1,
                }}
              >
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: empty ? "0 16px" : "12px 16px",
                alignItems: "flex-start",
                flex: 1,
                flexWrap: "wrap",
              }}
            >
              {empty ? (
                <div
                  style={{
                    width: "100%",
                    height: 1,
                    background: "#eee8e0",
                    alignSelf: "center",
                  }}
                />
              ) : (
                day.map((item) => {
                  const isM = item.type === "music",
                    ic = gc(item.id),
                    sel = selectedIds.includes(item.id),
                    meta = TYPE_META[item.type];
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) =>
                        e.dataTransfer.setData(
                          "text/folio-item",
                          String(item.id),
                        )
                      }
                      onClick={(e) => onItemClick(e, item.id)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                        cursor: "grab",
                      }}
                    >
                      <div
                        style={{
                          width: isM ? 110 : 68,
                          height: isM ? 40 : 82,
                          borderRadius: 2,
                          overflow: "hidden",
                          border: sel
                            ? `2px solid ${meta.accent}`
                            : "1px solid #ddd5c8",
                          background: isM
                            ? "#f0ebe3"
                            : `linear-gradient(148deg,${rg(item.hue, 0.16)},${rg(item.hue, 0.34)})`,
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {!isM && (
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              backgroundImage: `repeating-linear-gradient(-45deg,${rg(item.hue, 0.05)} 0px,${rg(item.hue, 0.05)} 1px,transparent 1px,transparent 8px)`,
                            }}
                          />
                        )}
                        {isM && <Waveform hue={item.hue} bars={12} maxH={9} />}
                        <div
                          style={{
                            position: "absolute",
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: "rgba(255,255,255,0.9)",
                            padding: "2px 4px",
                            fontSize: 8,
                            color: "#4a3a28",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.title}
                        </div>
                      </div>
                      {ic.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 2,
                            justifyContent: "center",
                          }}
                        >
                          {ic.map((c) => (
                            <div
                              key={c.id}
                              style={{
                                width: 4,
                                height: 4,
                                borderRadius: "50%",
                                background: c.color,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            {!empty && (
              <div
                style={{
                  alignSelf: "center",
                  marginRight: 14,
                  flexShrink: 0,
                  fontSize: 9,
                  color: "#ccc0b8",
                }}
              >
                {day.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GridView({
  items,
  selectedIds,
  canvases,
  tagColors,
  onItemClick,
  onDrop,
  openCanvasId,
}) {
  const [dragOver, setDragOver] = useState(false);
  const gc = (id) => canvases.filter((c) => c.itemIds.includes(id));
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflowY: "auto",
        background: "#fdfaf7",
        padding: 20,
        fontFamily: mono,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(e.dataTransfer.files);
      }}
    >
      {openCanvasId && (
        <div
          style={{
            marginBottom: 12,
            padding: "6px 12px",
            background: "#fdf8f0",
            border: "1px solid #f0e0c0",
            borderRadius: 2,
            fontSize: 9,
            color: "#a06830",
          }}
        >
          drag items onto the canvas to add them →
        </div>
      )}
      {dragOver && (
        <div
          style={{
            position: "sticky",
            top: -20,
            zIndex: 10,
            margin: "-20px -20px 16px",
            background: "#fff9f0",
            borderBottom: "2px solid #c8a870",
            padding: "10px 20px",
            fontSize: 10,
            color: "#a06830",
          }}
        >
          ⊕ drop to add to today
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(148px,1fr))",
          gap: 14,
        }}
      >
        {items.map((item) => {
          const meta = TYPE_META[item.type],
            isM = item.type === "music",
            ic = gc(item.id),
            sel = selectedIds.includes(item.id);
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) =>
                e.dataTransfer.setData("text/folio-item", String(item.id))
              }
              onClick={(e) => onItemClick(e, item.id)}
              style={{
                cursor: "grab",
                borderRadius: 3,
                overflow: "hidden",
                border: sel ? `2px solid ${meta.accent}` : "1px solid #ddd5c8",
                boxShadow: sel
                  ? "0 4px 16px rgba(0,0,0,0.13)"
                  : "0 1px 4px rgba(0,0,0,0.07)",
                background: "#faf7f3",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  aspectRatio: isM ? "3/1" : "4/5",
                  background: isM
                    ? "#f0ebe3"
                    : `linear-gradient(148deg,${rg(item.hue, 0.16)},${rg(item.hue, 0.34)})`,
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {!isM && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backgroundImage: `repeating-linear-gradient(-45deg,${rg(item.hue, 0.05)} 0px,${rg(item.hue, 0.05)} 1px,transparent 1px,transparent 8px)`,
                    }}
                  />
                )}
                {isM && <Waveform hue={item.hue} bars={22} maxH={18} />}
                <div
                  style={{
                    position: "absolute",
                    top: 6,
                    left: 6,
                    background: "rgba(255,255,255,0.86)",
                    borderRadius: 20,
                    padding: "2px 7px",
                    fontSize: 9,
                    color: meta.accent,
                  }}
                >
                  {meta.icon} {meta.label}
                </div>
              </div>
              <div
                style={{
                  padding: "7px 10px 9px",
                  borderTop: "1px solid #ede8e0",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                }}
              >
                <div
                  style={{ fontSize: 11, color: "#352a1e", marginBottom: 2 }}
                >
                  {item.title}
                </div>
                <div style={{ fontSize: 9, color: "#b0a090" }}>{item.date}</div>
                {ic.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {ic.map((c) => (
                      <div
                        key={c.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: c.color,
                          }}
                        />
                        <span style={{ fontSize: 8, color: c.color }}>
                          {c.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {item.tags?.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {item.tags.map((t) => (
                      <TagChip key={t} tag={t} color={tagColors[t]} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Sidebar({
  canvases,
  tagIndex,
  tagColors,
  items,
  selectedIds,
  openCanvasId,
  setOpenCanvasId,
  onCreateCanvas,
  onOpenNew,
}) {
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");
  const [expanded, setExpanded] = useState(null);
  return (
    <div
      style={{
        width: 224,
        flexShrink: 0,
        background: "#fdfaf7",
        borderRight: "1px solid #e8e0d4",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        fontFamily: mono,
      }}
    >
      <div style={{ padding: "16px 14px 10px" }}>
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 10 }}
        >
          <div
            style={{
              fontSize: 10,
              color: "#8a7a6a",
              letterSpacing: "0.12em",
              flex: 1,
            }}
          >
            CANVASES
          </div>
          <button
            onClick={onOpenNew}
            style={{
              background: "none",
              border: "1px solid #e0d8d0",
              borderRadius: 2,
              padding: "2px 8px",
              fontSize: 9,
              color: "#8a7a6a",
              cursor: "pointer",
              fontFamily: mono,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#a06830";
              e.currentTarget.style.color = "#a06830";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e0d8d0";
              e.currentTarget.style.color = "#8a7a6a";
            }}
          >
            + new
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div
            style={{
              marginBottom: 12,
              padding: 11,
              background: "#fff9f2",
              borderRadius: 3,
              border: "1px solid #efd8b0",
            }}
          >
            <div style={{ fontSize: 9, color: "#a06830", marginBottom: 8 }}>
              {selectedIds.length} selected — open on canvas
            </div>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="canvas name..."
              style={{
                width: "100%",
                background: "none",
                border: "none",
                borderBottom: "1px solid #e8d8b8",
                color: "#352a1e",
                fontSize: 11,
                padding: "3px 0",
                outline: "none",
                marginBottom: 7,
                boxSizing: "border-box",
                fontFamily: mono,
              }}
            />
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="opening thought..."
              rows={2}
              style={{
                width: "100%",
                background: "none",
                border: "none",
                borderBottom: "1px solid #e8d8b8",
                color: "#6a5a4a",
                fontSize: 10,
                padding: "3px 0",
                outline: "none",
                resize: "none",
                marginBottom: 9,
                boxSizing: "border-box",
                lineHeight: 1.6,
                fontFamily: mono,
              }}
            />
            <button
              onClick={() => {
                onCreateCanvas(newName || "untitled canvas", newNote);
                setNewName("");
                setNewNote("");
              }}
              style={{
                background: "#a06830",
                border: "none",
                color: "#fff",
                fontSize: 9,
                padding: "5px 10px",
                cursor: "pointer",
                borderRadius: 2,
                fontFamily: mono,
              }}
            >
              open on new canvas →
            </button>
          </div>
        )}

        {canvases.length === 0 && selectedIds.length === 0 && (
          <div
            style={{
              fontSize: 9,
              color: "#d0c8be",
              fontStyle: "italic",
              marginBottom: 8,
            }}
          >
            no canvases yet
          </div>
        )}

        {canvases.map((cv) => {
          const ci = items.filter((i) => cv.itemIds.includes(i.id));
          const isOpen = openCanvasId === cv.id,
            isEx = expanded === cv.id;
          return (
            <div key={cv.id} style={{ marginBottom: 6 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 8px",
                  borderRadius: 3,
                  border: `1px solid ${isOpen ? cv.color + "88" : "#e8e0d4"}`,
                  background: isOpen ? cv.color + "10" : "#fff",
                  cursor: "pointer",
                }}
                onClick={() => setExpanded(isEx ? null : cv.id)}
              >
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: cv.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "#352a1e",
                    flex: 1,
                    minWidth: 0,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {cv.name}
                </span>
                <span style={{ fontSize: 9, color: "#c0b0a0", flexShrink: 0 }}>
                  {cv.itemIds.length}
                </span>
                {(cv.edges || []).length > 0 && (
                  <span
                    style={{ fontSize: 8, color: "#9a8878", flexShrink: 0 }}
                  >
                    ✦{cv.edges.length}
                  </span>
                )}
                {(cv.references || []).length > 0 && (
                  <span
                    style={{ fontSize: 8, color: "#9a8878", flexShrink: 0 }}
                  >
                    ◎{cv.references.length}
                  </span>
                )}
                <span style={{ fontSize: 8, color: "#c0b0a0", flexShrink: 0 }}>
                  {isEx ? "▲" : "▼"}
                </span>
              </div>
              {isEx && (
                <div
                  style={{
                    padding: "8px 10px 10px",
                    background: "#faf7f3",
                    border: "1px solid #e8e0d4",
                    borderTop: "none",
                    borderRadius: "0 0 3px 3px",
                    marginBottom: 2,
                  }}
                >
                  {cv.note && (
                    <div
                      style={{
                        fontSize: 9,
                        color: "#8a7a6a",
                        lineHeight: 1.7,
                        fontStyle: "italic",
                        marginBottom: 8,
                      }}
                    >
                      "{cv.note}"
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 2,
                      marginBottom: 8,
                    }}
                  >
                    {ci.slice(0, 8).map((item) => (
                      <div
                        key={item.id}
                        title={item.title}
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 2,
                          background: `linear-gradient(135deg,${rg(item.hue, 0.22)},${rg(item.hue, 0.42)})`,
                          border: `1px solid ${rg(item.hue, 0.28)}`,
                        }}
                      />
                    ))}
                    {ci.length > 8 && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 2,
                          background: "#f0ebe4",
                          border: "1px solid #e0d8d0",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 8,
                          color: "#b0a090",
                        }}
                      >
                        +{ci.length - 8}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setOpenCanvasId(cv.id)}
                    style={{
                      fontSize: 9,
                      background: isOpen ? "#a06830" : "none",
                      border: `1px solid ${isOpen ? "#a06830" : "#d8d0c4"}`,
                      color: isOpen ? "#fff" : "#8a7a6a",
                      padding: "4px 8px",
                      borderRadius: 2,
                      cursor: "pointer",
                      fontFamily: mono,
                    }}
                  >
                    {isOpen ? "open ✓" : "open canvas"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ height: 1, background: "#ede8e0", margin: "4px 0" }} />
      <div style={{ padding: "12px 14px 16px" }}>
        <div
          style={{
            fontSize: 10,
            color: "#8a7a6a",
            letterSpacing: "0.12em",
            marginBottom: 10,
          }}
        >
          TAGS
        </div>
        {Object.keys(tagIndex)
          .sort()
          .map((tag) => (
            <div
              key={tag}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 8px",
                borderRadius: 3,
                border: "1px solid #e8e0d4",
                background: "#fff",
                marginBottom: 5,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  color: tagColors[tag] || "#8a7a6a",
                  flex: 1,
                }}
              >
                # {tag}
              </span>
              <span style={{ fontSize: 9, color: "#c0b0a0" }}>
                {tagIndex[tag]?.length || 0}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

function DetailDrawer({
  item,
  canvases,
  tagColors,
  onClose,
  onAddTag,
  onRemoveTag,
}) {
  const [ti, setTi] = useState("");
  const meta = TYPE_META[item.type],
    isM = item.type === "music";
  const ic = canvases.filter((c) => c.itemIds.includes(item.id));
  const sub = () => {
    const t = ti.trim().toLowerCase().replace(/\s+/g, "-");
    if (t) {
      onAddTag(item.id, t);
      setTi("");
    }
  };
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 224,
        right: 0,
        height: 196,
        background: "#fdfaf7",
        borderTop: "2px solid #e8e0d4",
        boxShadow: "0 -4px 20px rgba(0,0,0,0.08)",
        display: "flex",
        zIndex: 150,
        fontFamily: mono,
      }}
    >
      <div
        style={{
          width: 150,
          flexShrink: 0,
          background: isM
            ? "#f0ebe3"
            : `linear-gradient(148deg,${rg(item.hue, 0.18)},${rg(item.hue, 0.36)})`,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRight: "1px solid #e8e0d4",
        }}
      >
        {!isM && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(-45deg,${rg(item.hue, 0.06)} 0px,${rg(item.hue, 0.06)} 1px,transparent 1px,transparent 8px)`,
            }}
          />
        )}
        {isM && <Waveform hue={item.hue} bars={16} maxH={18} />}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(255,255,255,0.86)",
            borderRadius: 20,
            padding: "2px 8px",
            fontSize: 9,
            color: meta.accent,
          }}
        >
          {meta.icon} {meta.label}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 9,
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 15, color: "#352a1e", marginBottom: 3 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 10, color: "#b0a090" }}>
              {new Date(item.date + "T12:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#c0b0a0",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
              fontFamily: mono,
            }}
          >
            ×
          </button>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          {ic.length > 0 ? (
            ic.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: c.color + "18",
                  border: `1px solid ${c.color}44`,
                  borderRadius: 20,
                  padding: "2px 8px",
                }}
              >
                <div
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: c.color,
                  }}
                />
                <span style={{ fontSize: 9, color: c.color }}>{c.name}</span>
              </div>
            ))
          ) : (
            <span
              style={{ fontSize: 9, color: "#c8c0b4", fontStyle: "italic" }}
            >
              not on any canvas
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            flexWrap: "wrap",
          }}
        >
          {(item.tags || []).map((t) => (
            <TagChip
              key={t}
              tag={t}
              color={tagColors[t]}
              onRemove={() => onRemoveTag(item.id, t)}
            />
          ))}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              border: "1px solid #ddd5c8",
              borderRadius: 20,
              overflow: "hidden",
              height: 22,
            }}
          >
            <input
              value={ti}
              onChange={(e) => setTi(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sub()}
              placeholder="add tag..."
              style={{
                background: "none",
                border: "none",
                fontSize: 9,
                padding: "0 8px",
                outline: "none",
                color: "#6a5a4a",
                width: 80,
                fontFamily: mono,
              }}
            />
            <button
              onClick={sub}
              style={{
                background: "#f0ebe4",
                border: "none",
                borderLeft: "1px solid #ddd5c8",
                padding: "0 8px",
                cursor: "pointer",
                fontSize: 9,
                color: "#8a7a6a",
                height: "100%",
                fontFamily: mono,
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Folio() {
  const [view, setView] = useState("longview");
  const [items, setItems] = useState(INIT_ITEMS);
  const [canvases, setCanvases] = useState(INIT_CANVASES);
  const [selectedIds, setSelectedIds] = useState([]);
  const [filter, setFilter] = useState("all");
  const [detailItem, setDetailItem] = useState(null);
  const [openCanvasId, setOpenCanvasId] = useState(null);
  const [globalDragOver, setGlobalDragOver] = useState(false);

  const tagIndex = {};
  items.forEach((item) =>
    (item.tags || []).forEach((t) => {
      if (!tagIndex[t]) tagIndex[t] = [];
      tagIndex[t].push(item);
    }),
  );
  const allTags = Object.keys(tagIndex).sort();
  const tagColors = {};
  allTags.forEach((t, i) => (tagColors[t] = TAG_COLORS[i % TAG_COLORS.length]));
  const allDates = allDatesInRange(items);
  const filtered =
    filter === "all" ? items : items.filter((i) => i.type === filter);
  const byDate = {};
  filtered.forEach((i) => {
    if (!byDate[i.date]) byDate[i.date] = [];
    byDate[i.date].push(i);
  });
  const gaps = allDates.filter((d) => !(byDate[d] || []).length).length;
  const openCanvas = canvases.find((c) => c.id === openCanvasId) || null;

  const addFiles = useCallback((files) => {
    const today = new Date().toISOString().slice(0, 10);
    const typeGuess = (n) => {
      const e = n.split(".").pop().toLowerCase();
      if (["mp3", "wav", "aiff", "m4a"].includes(e)) return "music";
      if (["gif", "mp4", "mov"].includes(e)) return "animation";
      return "sketch";
    };
    const hues = [
      "176,120,72",
      "160,108,64",
      "140,116,100",
      "110,96,80",
      "88,104,122",
    ];
    setItems((prev) => [
      ...prev,
      ...Array.from(files).map((f, i) => ({
        id: Date.now() + i,
        type: typeGuess(f.name),
        date: today,
        title: f.name.replace(/\.[^.]+$/, ""),
        hue: hues[(prev.length + i) % hues.length],
        tags: [],
      })),
    ]);
  }, []);

  const simulateAdd = useCallback(() => {
    const titles = [
      "morning study",
      "quick gesture",
      "color note",
      "sketchbook page",
      "texture study",
      "figure rough",
    ];
    addFiles([
      { name: `${titles[Math.floor(Math.random() * titles.length)]}.jpg` },
    ]);
  }, [addFiles]);

  useEffect(() => {
    const a = (e) => {
      if (e.dataTransfer.types.includes("Files") && view !== "canvas")
        setGlobalDragOver(true);
    };
    const l = (e) => {
      if (!e.relatedTarget) setGlobalDragOver(false);
    };
    const o = (e) => e.preventDefault();
    const d = (e) => {
      e.preventDefault();
      setGlobalDragOver(false);
    };
    window.addEventListener("dragenter", a);
    window.addEventListener("dragleave", l);
    window.addEventListener("dragover", o);
    window.addEventListener("drop", d);
    return () => {
      window.removeEventListener("dragenter", a);
      window.removeEventListener("dragleave", l);
      window.removeEventListener("dragover", o);
      window.removeEventListener("drop", d);
    };
  }, [view]);

  const onItemClick = useCallback(
    (e, id) => {
      e.stopPropagation();
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelectedIds((p) =>
          p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
        );
        setDetailItem(null);
      } else {
        setSelectedIds([]);
        setDetailItem((p) =>
          p?.id === id ? null : items.find((i) => i.id === id),
        );
      }
    },
    [items],
  );

  const onCreateCanvas = useCallback(
    (name, note) => {
      if (!selectedIds.length) return;
      const id = Date.now(),
        color = CANVAS_PAL[canvases.length % CANVAS_PAL.length];
      const positions = {};
      selectedIds.forEach(
        (sid, i) =>
          (positions[sid] = {
            x: 60 + (i % 4) * 185,
            y: 60 + Math.floor(i / 4) * 230,
          }),
      );
      setCanvases((prev) => [
        ...prev,
        {
          id,
          name,
          note: note || "",
          color,
          itemIds: [...selectedIds],
          positions,
          notes: [],
          edges: [],
          strokes: [],
          references: [],
        },
      ]);
      setOpenCanvasId(id);
      setView("canvas");
      setSelectedIds([]);
    },
    [selectedIds, canvases.length],
  );

  const onOpenNew = useCallback(() => {
    const id = Date.now(),
      color = CANVAS_PAL[canvases.length % CANVAS_PAL.length];
    setCanvases((prev) => [
      ...prev,
      {
        id,
        name: "untitled canvas",
        note: "",
        color,
        itemIds: [],
        positions: {},
        notes: [],
        edges: [],
        strokes: [],
        references: [],
      },
    ]);
    setOpenCanvasId(id);
    setView("canvas");
  }, [canvases.length]);

  const navBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setView(key)}
      style={{
        background: "none",
        border: "none",
        borderBottom:
          view === key ? "2px solid #a06830" : "2px solid transparent",
        color: view === key ? "#352a1e" : "#b8a898",
        fontSize: 11,
        padding: "0 0 10px",
        cursor: "pointer",
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        fontFamily: mono,
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#f5f1eb",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: mono,
      }}
    >
      {globalDragOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(253,250,247,0.92)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "3px dashed #c8a870",
            boxSizing: "border-box",
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setGlobalDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.5 }}>
              ⊕
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#6a5a4a",
                letterSpacing: "0.06em",
              }}
            >
              drop to add to today
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          height: 50,
          background: "#fdfaf7",
          borderBottom: "1px solid #e8e0d4",
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 22,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 14,
            color: "#352a1e",
            letterSpacing: "0.26em",
            flexShrink: 0,
          }}
        >
          folio
        </span>
        <div
          style={{
            display: "flex",
            gap: 20,
            alignItems: "flex-end",
            height: "100%",
            paddingTop: 4,
          }}
        >
          {navBtn("longview", "long view")}
          {navBtn("strip", "daily strip")}
          {navBtn("grid", "grid")}
          <button
            onClick={() => setView("canvas")}
            style={{
              background: "none",
              border: "none",
              borderBottom:
                view === "canvas"
                  ? "2px solid #a06830"
                  : "2px solid transparent",
              color: view === "canvas" ? "#352a1e" : "#b8a898",
              fontSize: 11,
              padding: "0 0 10px",
              cursor: "pointer",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "flex-end",
              gap: 5,
              fontFamily: mono,
            }}
          >
            canvas
            {openCanvas && (
              <span
                style={{
                  fontSize: 9,
                  color: openCanvas.color,
                  marginBottom: 1,
                }}
              >
                · {openCanvas.name}
              </span>
            )}
          </button>
        </div>
        <div
          style={{
            display: "flex",
            gap: 4,
            marginLeft: "auto",
            alignItems: "center",
          }}
        >
          {view !== "longview" && view !== "canvas" && (
            <>
              {["all", ...Object.keys(TYPE_META)].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    background:
                      filter === f
                        ? f === "all"
                          ? "#e8e0d0"
                          : TYPE_META[f]?.accent + "20"
                        : "none",
                    border: `1px solid ${filter === f ? (f === "all" ? "#cfc8b8" : TYPE_META[f]?.accent + "55") : "#e2dbd2"}`,
                    color:
                      filter === f
                        ? f === "all"
                          ? "#5a4a38"
                          : TYPE_META[f]?.accent
                        : "#b8a898",
                    fontSize: 10,
                    padding: "3px 9px",
                    borderRadius: 20,
                    cursor: "pointer",
                    fontFamily: mono,
                  }}
                >
                  {f === "all" ? "all" : TYPE_META[f].label}
                </button>
              ))}
              <div
                style={{
                  width: 1,
                  height: 18,
                  background: "#ddd5c8",
                  margin: "0 4px",
                }}
              />
            </>
          )}
          <button
            onClick={simulateAdd}
            style={{
              background: "#f5f0e8",
              border: "1px solid #d0c8bc",
              color: "#8a7a6a",
              fontSize: 10,
              padding: "5px 10px",
              cursor: "pointer",
              borderRadius: 2,
              fontFamily: mono,
            }}
          >
            simulate add
          </button>
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div
          style={{
            padding: "5px 22px 5px 246px",
            background: "#fff9f2",
            borderBottom: "1px solid #f0d8b0",
            fontSize: 10,
            color: "#a06830",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span>{selectedIds.length} selected</span>
          <span style={{ color: "#d0b888" }}>
            name and open on a canvas in the sidebar →
          </span>
          <button
            onClick={() => setSelectedIds([])}
            style={{
              marginLeft: "auto",
              background: "none",
              border: "none",
              color: "#c8a880",
              cursor: "pointer",
              fontSize: 10,
              fontFamily: mono,
            }}
          >
            clear
          </button>
        </div>
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <Sidebar
          canvases={canvases}
          tagIndex={tagIndex}
          tagColors={tagColors}
          items={items}
          selectedIds={selectedIds}
          openCanvasId={openCanvasId}
          setOpenCanvasId={(id) => {
            setOpenCanvasId(id);
            setView("canvas");
          }}
          onCreateCanvas={onCreateCanvas}
          onOpenNew={onOpenNew}
        />
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          {view === "longview" && (
            <LongView items={items} canvases={canvases} tagColors={tagColors} />
          )}
          {view === "strip" && (
            <StripView
              allDates={allDates}
              byDate={byDate}
              selectedIds={selectedIds}
              canvases={canvases}
              onItemClick={onItemClick}
              onDrop={addFiles}
              openCanvasId={openCanvasId}
            />
          )}
          {view === "grid" && (
            <GridView
              items={filtered}
              selectedIds={selectedIds}
              canvases={canvases}
              tagColors={tagColors}
              onItemClick={onItemClick}
              onDrop={addFiles}
              openCanvasId={openCanvasId}
            />
          )}
          {view === "canvas" && (
            <CanvasView
              canvas={openCanvas}
              allItems={items}
              canvases={canvases}
              setCanvases={setCanvases}
              selectedIds={selectedIds}
              onItemClick={onItemClick}
              onCanvasClick={() => {
                setSelectedIds([]);
                setDetailItem(null);
              }}
              onOpenCanvas={onOpenNew}
            />
          )}
          {detailItem && view !== "longview" && (
            <DetailDrawer
              item={detailItem}
              canvases={canvases}
              tagColors={tagColors}
              onClose={() => setDetailItem(null)}
              onAddTag={(id, tag) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === id
                      ? { ...i, tags: [...new Set([...(i.tags || []), tag])] }
                      : i,
                  ),
                )
              }
              onRemoveTag={(id, tag) =>
                setItems((prev) =>
                  prev.map((i) =>
                    i.id === id
                      ? { ...i, tags: (i.tags || []).filter((t) => t !== tag) }
                      : i,
                  ),
                )
              }
            />
          )}
        </div>
      </div>

      <div
        style={{
          height: 26,
          background: "#fdfaf7",
          borderTop: "1px solid #e8e0d4",
          display: "flex",
          alignItems: "center",
          padding: `0 22px 0 ${view === "longview" ? "22px" : "246px"}`,
          gap: 20,
          fontSize: 10,
          color: "#c8c0b4",
          letterSpacing: "0.03em",
          flexShrink: 0,
          zIndex: 160,
          fontFamily: mono,
        }}
      >
        <span>{items.length} items</span>
        <span>
          {canvases.length} canvas{canvases.length !== 1 ? "es" : ""}
        </span>
        <span>{allTags.length} tags</span>
        <span>
          {gaps} gap{gaps !== 1 ? "s" : ""}
        </span>
        <span style={{ marginLeft: "auto", color: "#d8d0c8" }}>~/Folio/</span>
      </div>
    </div>
  );
}
