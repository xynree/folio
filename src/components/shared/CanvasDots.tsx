export function CanvasDots({ colors }: { colors: string[] }) {
  if (!colors.length) return <span className="canvas-membership-dots empty" />;

  return (
    <span className="canvas-membership-dots" aria-label={`${colors.length} boards`}>
      {colors.slice(0, 6).map((color, index) => (
        <span
          key={`${color}-${index}`}
          style={{ background: color }}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}
