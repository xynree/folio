import { useState, useRef, useCallback } from "react";

// ── Palette & constants ───────────────────────────────────────────────────────
const C = {
  bg: "#f4f1ec",
  paper: "#faf8f4",
  border: "#e2dbd0",
  borderLight: "#ede8e0",
  text: "#2a2218",
  textMid: "#7a6e60",
  textFaint: "#b8b0a4",
  accent: "#8a5c28",
  accentLight: "#c8943c",
  canvas: "#edeae3",
  dot: "#d4ccc0",
};

const MONO = "'Courier New', monospace";

const TYPE_COLOR = {
  sketch: "#8a5c28",
  reference: "#5a6848",
  music: "#3a5868",
  animation: "#684858",
};

const ITEMS = [
  { id: 1, type: "sketch", date: "feb 22", title: "figure study #5" },
  { id: 2, type: "sketch", date: "feb 22", title: "hand gestures" },
  { id: 3, type: "reference", date: "feb 22", title: "hopper ref" },
  { id: 4, type: "sketch", date: "feb 20", title: "figure study #4" },
  { id: 5, type: "sketch", date: "feb 20", title: "window study" },
  { id: 6, type: "music", date: "feb 19", title: "chord idea 1" },
  { id: 7, type: "reference", date: "feb 17", title: "rembrandt light" },
  { id: 8, type: "sketch", date: "feb 17", title: "figure study #3" },
  { id: 9, type: "animation", date: "feb 14", title: "walk cycle rough" },
  { id: 10, type: "sketch", date: "feb 14", title: "cafe scene" },
  { id: 11, type: "reference", date: "feb 11", title: "sargent ref" },
  { id: 12, type: "sketch", date: "feb 11", title: "figure study #2" },
];

const DAYS = [
  { date: "feb 22", ids: [1, 2, 3] },
  { date: "feb 21", ids: [] },
  { date: "feb 20", ids: [4, 5] },
  { date: "feb 19", ids: [6] },
  { date: "feb 18", ids: [] },
  { date: "feb 17", ids: [7, 8] },
  { date: "feb 16", ids: [] },
  { date: "feb 15", ids: [] },
  { date: "feb 14", ids: [9, 10] },
  { date: "feb 13", ids: [] },
  { date: "feb 12", ids: [] },
  { date: "feb 11", ids: [11, 12] },
];

const INIT_CANVASES = [
  {
    id: 1,
    name: "figure studies",
    color: "#8a5c28",
    itemIds: [1, 4, 8],
    positions: {
      1: { x: 40, y: 60 },
      4: { x: 220, y: 50 },
      8: { x: 130, y: 240 },
    },
    edges: [{ id: "e1", fromId: 1, toId: 4, label: "weight" }],
    notes: [{ id: "n1", x: 360, y: 80, text: "not the face — the torso" }],
  },
  {
    id: 2,
    name: "light studies",
    color: "#5a6848",
    itemIds: [3, 7, 11],
    positions: {
      3: { x: 40, y: 60 },
      7: { x: 230, y: 55 },
      11: { x: 140, y: 250 },
    },
    edges: [],
    notes: [],
  },
];

// ── Item thumbnail ─────────────────────────────────────────────────────────────
function Thumb({ item, size = 64, selected, onCanvas }) {
  const color = TYPE_COLOR[item.type];
  const isM = item.type === "music";
  return (
    <div
      style={{
        width: size,
        height: isM ? size * 0.5 : size,
        borderRadius: 2,
        background: `linear-gradient(145deg, ${color}18, ${color}30)`,
        border: `1px solid ${selected ? color : onCanvas ? color + "60" : C.border}`,
        boxShadow: selected ? `0 0 0 2px ${color}40` : "none",
        position: "relative",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `repeating-linear-gradient(-45deg, ${color}08 0, ${color}08 1px, transparent 1px, transparent 7px)`,
        }}
      />
      {isM && (
        <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
          {[3, 5, 4, 6, 3, 5, 4, 3].map((h, i) => (
            <div
              key={i}
              style={{
                width: 2,
                height: h * 2,
                background: color,
                opacity: 0.5,
                borderRadius: 1,
              }}
            />
          ))}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "2px 4px",
          background: "rgba(250,248,244,0.88)",
          fontSize: 8,
          color: C.textMid,
          fontFamily: MONO,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.title}
      </div>
      {onCanvas && (
        <div
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: color,
          }}
        />
      )}
    </div>
  );
}

// ── Canvas item card ───────────────────────────────────────────────────────────
function CanvasCard({ item, pos, dragging, onMouseDown }) {
  const color = TYPE_COLOR[item.type];
  const isM = item.type === "music";
  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        width: 110,
        height: isM ? 56 : 130,
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        zIndex: dragging ? 50 : 10,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 2,
          background: `linear-gradient(145deg, ${color}14, ${color}28)`,
          border: `1px solid ${color}50`,
          boxShadow: dragging
            ? "0 8px 24px rgba(0,0,0,0.18)"
            : "0 1px 6px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: dragging ? "none" : "box-shadow 0.15s",
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
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `repeating-linear-gradient(-45deg, ${color}06 0, ${color}06 1px, transparent 1px, transparent 8px)`,
            }}
          />
          {isM && (
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              {[3, 5, 4, 6, 3, 5, 4, 3, 5, 4].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: 2,
                    height: h * 2.5,
                    background: color,
                    opacity: 0.45,
                    borderRadius: 1,
                  }}
                />
              ))}
            </div>
          )}
          <div
            style={{
              position: "absolute",
              top: 4,
              left: 4,
              fontSize: 7,
              color,
              fontFamily: MONO,
              background: "rgba(250,248,244,0.85)",
              borderRadius: 10,
              padding: "1px 5px",
            }}
          >
            {item.type}
          </div>
        </div>
        <div
          style={{
            padding: "4px 6px 5px",
            background: "rgba(250,248,244,0.92)",
            borderTop: `1px solid ${color}20`,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: C.text,
              fontFamily: MONO,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {item.title}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Strip view ─────────────────────────────────────────────────────────────────
function StripView({
  items,
  canvasItemIds,
  selectedIds,
  onSelect,
  onDragStart,
}) {
  const byDate = {};
  items.forEach((i) => {
    byDate[i.id] = i;
  });

  return (
    <div style={{ overflowY: "auto", flex: 1 }}>
      {DAYS.map(({ date, ids }) => {
        const empty = ids.length === 0;
        return (
          <div
            key={date}
            style={{
              display: "flex",
              borderBottom: `1px solid ${C.borderLight}`,
              minHeight: empty ? 28 : "auto",
              background: empty ? C.bg : C.paper,
            }}
          >
            <div
              style={{
                width: 72,
                flexShrink: 0,
                padding: empty ? "6px 10px" : "10px 10px",
                borderRight: `1px solid ${C.borderLight}`,
                display: "flex",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: empty ? C.textFaint : C.textMid,
                  fontFamily: MONO,
                }}
              >
                {date}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                padding: empty ? "0 10px" : "10px 10px",
                alignItems: "center",
                flexWrap: "wrap",
                flex: 1,
              }}
            >
              {empty ? (
                <div
                  style={{ height: 1, flex: 1, background: C.borderLight }}
                />
              ) : (
                ids.map((id) => {
                  const item = byDate[id];
                  if (!item) return null;
                  const sel = selectedIds.includes(id);
                  const onCv = canvasItemIds.includes(id);
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={(e) => onDragStart(e, id)}
                      onClick={() => onSelect(id)}
                      style={{ cursor: "grab" }}
                    >
                      <Thumb
                        item={item}
                        size={56}
                        selected={sel}
                        onCanvas={onCv}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Grid view ──────────────────────────────────────────────────────────────────
function GridView({
  items,
  canvasItemIds,
  selectedIds,
  onSelect,
  onDragStart,
}) {
  return (
    <div style={{ overflowY: "auto", flex: 1, padding: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 10,
        }}
      >
        {items.map((item) => {
          const sel = selectedIds.includes(item.id);
          const onCv = canvasItemIds.includes(item.id);
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => onDragStart(e, item.id)}
              onClick={() => onSelect(item.id)}
              style={{
                cursor: "grab",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <Thumb item={item} size={72} selected={sel} onCanvas={onCv} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Canvas panel ───────────────────────────────────────────────────────────────
function CanvasPanel({ canvas, allItems, onUpdate, onDrop }) {
  const surfRef = useRef(null);
  const dragRef = useRef(null);
  const off = useRef({ x: 0, y: 0 });
  const [draggingId, setDraggingId] = useState(null);
  const [dropHover, setDropHover] = useState(false);

  const getItem = (id) => allItems.find((i) => i.id === id);
  const getPos = (id) => canvas.positions[id] || { x: 60, y: 60 };

  const onCardMD = (e, id) => {
    e.stopPropagation();
    const r = surfRef.current.getBoundingClientRect();
    const pos = getPos(id);
    off.current = {
      x: e.clientX - r.left + surfRef.current.scrollLeft - pos.x,
      y: e.clientY - r.top + surfRef.current.scrollTop - pos.y,
    };
    setDraggingId(id);
    dragRef.current = id;

    const mm = (e2) => {
      if (!dragRef.current) return;
      const r2 = surfRef.current?.getBoundingClientRect();
      if (!r2) return;
      const nx =
        e2.clientX - r2.left + surfRef.current.scrollLeft - off.current.x;
      const ny =
        e2.clientY - r2.top + surfRef.current.scrollTop - off.current.y;
      onUpdate((c) => ({
        ...c,
        positions: { ...c.positions, [dragRef.current]: { x: nx, y: ny } },
      }));
    };
    const mu = () => {
      dragRef.current = null;
      setDraggingId(null);
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", mu);
    };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", mu);
  };

  const onSurfDrop = (e) => {
    e.preventDefault();
    setDropHover(false);
    const idStr = e.dataTransfer.getData("folio-item");
    if (!idStr) return;
    const id = parseInt(idStr);
    if (canvas.itemIds.includes(id)) return;
    const r = surfRef.current.getBoundingClientRect();
    const x = e.clientX - r.left + surfRef.current.scrollLeft - 55;
    const y = e.clientY - r.top + surfRef.current.scrollTop - 65;
    onUpdate((c) => ({
      ...c,
      itemIds: [...c.itemIds, id],
      positions: {
        ...c.positions,
        [id]: { x: Math.max(8, x), y: Math.max(8, y) },
      },
    }));
  };

  if (!canvas)
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: C.canvas,
        }}
      >
        <span style={{ fontSize: 11, color: C.textFaint, fontFamily: MONO }}>
          no canvas open
        </span>
      </div>
    );

  const color = canvas.color;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Canvas header */}
      <div
        style={{
          height: 36,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 14px",
          gap: 8,
          borderBottom: `1px solid ${C.border}`,
          background: C.paper,
        }}
      >
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: color,
          }}
        />
        <span
          style={{
            fontSize: 10,
            color,
            fontFamily: MONO,
            letterSpacing: "0.04em",
          }}
        >
          {canvas.name}
        </span>
        <span style={{ fontSize: 9, color: C.textFaint, fontFamily: MONO }}>
          {canvas.itemIds.length} items · {canvas.edges.length} edges ·{" "}
          {canvas.notes.length} notes
        </span>
      </div>

      {/* Canvas surface */}
      <div
        ref={surfRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={onSurfDrop}
        style={{
          flex: 1,
          overflow: "auto",
          position: "relative",
          background: dropHover
            ? `radial-gradient(${color}18 1px, transparent 1px)`
            : `radial-gradient(${C.dot} 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          backgroundPosition: dropHover ? "0 0" : "0 0",
          outline: dropHover ? `2px dashed ${color}60` : "none",
          outlineOffset: -2,
          transition: "outline 0.1s",
        }}
      >
        <div style={{ width: 1600, height: 1200, position: "relative" }}>
          {/* Edges */}
          <svg
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 4,
            }}
            overflow="visible"
          >
            {canvas.edges.map((edge) => {
              const fp = getPos(edge.fromId),
                tp = getPos(edge.toId);
              const x1 = fp.x + 55,
                y1 = fp.y + 65;
              const x2 = tp.x + 55,
                y2 = tp.y + 65;
              const mx = (x1 + x2) / 2,
                my = (y1 + y2) / 2;
              const dx = x2 - x1,
                dy = y2 - y1;
              const cx = mx - dy * 0.15,
                cy = my + dx * 0.15;
              return (
                <g key={edge.id}>
                  <path
                    d={`M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`}
                    stroke={color}
                    strokeWidth="1.5"
                    fill="none"
                    opacity="0.4"
                    strokeDasharray="5,3"
                  />
                  {edge.label && (
                    <text
                      x={cx}
                      y={cy - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill={color}
                      fontFamily={MONO}
                      opacity="0.8"
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Item cards */}
          {canvas.itemIds.map((id) => {
            const item = getItem(id);
            if (!item) return null;
            return (
              <CanvasCard
                key={id}
                item={item}
                pos={getPos(id)}
                dragging={draggingId === id}
                onMouseDown={(e) => onCardMD(e, id)}
              />
            );
          })}

          {/* Notes */}
          {canvas.notes.map((note) => (
            <div
              key={note.id}
              style={{
                position: "absolute",
                left: note.x,
                top: note.y,
                width: 160,
                background: "#fdf9ee",
                border: `1px solid ${color}30`,
                borderRadius: 2,
                padding: "6px 8px",
                zIndex: 20,
              }}
            >
              <div
                style={{
                  height: 4,
                  background: color,
                  opacity: 0.2,
                  borderRadius: "1px 1px 0 0",
                  margin: "-6px -8px 6px",
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  color: C.textMid,
                  fontFamily: MONO,
                  lineHeight: 1.7,
                }}
              >
                {note.text}
              </div>
            </div>
          ))}

          {/* Drop hint */}
          {dropHover && canvas.itemIds.length === 0 && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: color,
                  fontFamily: MONO,
                  opacity: 0.6,
                }}
              >
                drop here
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main app ───────────────────────────────────────────────────────────────────
export default function Folio() {
  const [archiveView, setArchiveView] = useState("strip"); // "strip" | "grid"
  const [canvases, setCanvases] = useState(INIT_CANVASES);
  const [openCanvasId, setOpenCanvasId] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [newName, setNewName] = useState("");

  const openCanvas = canvases.find((c) => c.id === openCanvasId) || null;
  const canvasItemIds = openCanvas?.itemIds || [];

  const updateCanvas = useCallback(
    (fn) => {
      setCanvases((prev) =>
        prev.map((c) => (c.id === openCanvasId ? fn(c) : c)),
      );
    },
    [openCanvasId],
  );

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("folio-item", String(id));
  };

  const onSelect = (id) => {
    setSelectedIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : [...p, id],
    );
  };

  const createCanvas = () => {
    if (!newName.trim() && selectedIds.length === 0) return;
    const id = Date.now();
    const colors = ["#8a5c28", "#5a6848", "#3a5868", "#684858", "#4a5870"];
    const color = colors[canvases.length % colors.length];
    const positions = {};
    selectedIds.forEach((sid, i) => {
      positions[sid] = {
        x: 40 + (i % 4) * 140,
        y: 40 + Math.floor(i / 4) * 160,
      };
    });
    const nc = {
      id,
      color,
      name: newName.trim() || "untitled",
      itemIds: [...selectedIds],
      positions,
      edges: [],
      notes: [],
    };
    setCanvases((p) => [...p, nc]);
    setOpenCanvasId(id);
    setSelectedIds([]);
    setNewName("");
  };

  const S = {
    root: {
      width: "100vw",
      height: "100vh",
      display: "flex",
      fontFamily: MONO,
      background: C.bg,
      overflow: "hidden",
      color: C.text,
    },
    sidebar: {
      width: 192,
      flexShrink: 0,
      background: C.paper,
      borderRight: `1px solid ${C.border}`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
    sideHead: {
      padding: "14px 14px 10px",
      borderBottom: `1px solid ${C.borderLight}`,
      display: "flex",
      alignItems: "center",
    },
    archivePanel: {
      flex: "0 0 340px",
      display: "flex",
      flexDirection: "column",
      borderRight: `1px solid ${C.border}`,
      overflow: "hidden",
      background: C.paper,
    },
    archiveHead: {
      height: 36,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      padding: "0 12px",
      gap: 10,
      borderBottom: `1px solid ${C.border}`,
      background: C.paper,
    },
    canvasArea: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    },
  };

  return (
    <div style={S.root}>
      {/* Sidebar */}
      <div style={S.sidebar}>
        <div style={S.sideHead}>
          <span
            style={{
              fontSize: 13,
              letterSpacing: "0.2em",
              color: C.text,
              flex: 1,
            }}
          >
            folio
          </span>
        </div>

        {/* Canvas list */}
        <div
          style={{
            padding: "10px 12px 8px",
            borderBottom: `1px solid ${C.borderLight}`,
          }}
        >
          <div
            style={{
              fontSize: 8,
              color: C.textFaint,
              letterSpacing: "0.14em",
              marginBottom: 8,
            }}
          >
            CANVASES
          </div>
          {canvases.map((cv) => (
            <div
              key={cv.id}
              onClick={() => setOpenCanvasId(cv.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 7px",
                borderRadius: 2,
                marginBottom: 3,
                cursor: "pointer",
                background:
                  openCanvasId === cv.id ? cv.color + "14" : "transparent",
                border: `1px solid ${openCanvasId === cv.id ? cv.color + "50" : "transparent"}`,
              }}
              onMouseEnter={(e) => {
                if (openCanvasId !== cv.id)
                  e.currentTarget.style.background = C.bg;
              }}
              onMouseLeave={(e) => {
                if (openCanvasId !== cv.id)
                  e.currentTarget.style.background = "transparent";
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: cv.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 10,
                  color: C.text,
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {cv.name}
              </span>
              <span style={{ fontSize: 8, color: C.textFaint }}>
                {cv.itemIds.length}
              </span>
            </div>
          ))}
        </div>

        {/* New canvas from selection */}
        <div style={{ padding: "10px 12px" }}>
          <div
            style={{
              fontSize: 8,
              color: C.textFaint,
              letterSpacing: "0.14em",
              marginBottom: 8,
            }}
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : "NEW CANVAS"}
          </div>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createCanvas()}
            placeholder="name..."
            style={{
              width: "100%",
              background: "none",
              border: "none",
              borderBottom: `1px solid ${C.border}`,
              color: C.text,
              fontSize: 10,
              padding: "3px 0",
              outline: "none",
              fontFamily: MONO,
              marginBottom: 8,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={createCanvas}
            style={{
              background: "none",
              border: `1px solid ${C.border}`,
              borderRadius: 2,
              padding: "4px 10px",
              fontSize: 9,
              color: C.textMid,
              cursor: "pointer",
              fontFamily: MONO,
              width: "100%",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = C.accent;
              e.currentTarget.style.color = C.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = C.border;
              e.currentTarget.style.color = C.textMid;
            }}
          >
            + open on canvas
          </button>
        </div>

        {/* Spacer + status */}
        <div style={{ flex: 1 }} />
        <div
          style={{
            padding: "10px 12px",
            borderTop: `1px solid ${C.borderLight}`,
            fontSize: 8,
            color: C.textFaint,
          }}
        >
          {ITEMS.length} items · {canvases.length} canvases
        </div>
      </div>

      {/* Archive panel */}
      <div style={S.archivePanel}>
        <div style={S.archiveHead}>
          {["strip", "grid"].map((v) => (
            <button
              key={v}
              onClick={() => setArchiveView(v)}
              style={{
                background: "none",
                border: "none",
                borderBottom:
                  archiveView === v
                    ? `2px solid ${C.accent}`
                    : "2px solid transparent",
                color: archiveView === v ? C.text : C.textFaint,
                fontSize: 10,
                padding: "0 0 8px",
                cursor: "pointer",
                fontFamily: MONO,
                letterSpacing: "0.04em",
                marginTop: 8,
              }}
            >
              {v === "strip" ? "daily strip" : "grid"}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {selectedIds.length > 0 && (
            <button
              onClick={() => setSelectedIds([])}
              style={{
                background: "none",
                border: "none",
                color: C.textFaint,
                fontSize: 9,
                cursor: "pointer",
                fontFamily: MONO,
              }}
            >
              clear ×
            </button>
          )}
        </div>

        {archiveView === "strip" ? (
          <StripView
            items={ITEMS}
            canvasItemIds={canvasItemIds}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onDragStart={onDragStart}
          />
        ) : (
          <GridView
            items={ITEMS}
            canvasItemIds={canvasItemIds}
            selectedIds={selectedIds}
            onSelect={onSelect}
            onDragStart={onDragStart}
          />
        )}
      </div>

      {/* Canvas area */}
      <div style={S.canvasArea}>
        <CanvasPanel
          canvas={openCanvas}
          allItems={ITEMS}
          onUpdate={updateCanvas}
          onDrop={() => {
            // null
          }}
        />
      </div>
    </div>
  );
}
