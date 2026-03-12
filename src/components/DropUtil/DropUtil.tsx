export default function DropUtil({
  callback,
}: {
  callback?: (e: React.DragEvent<HTMLDivElement>) => void;
}) {
  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }
  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    callback?.(event);
  }

  return (
    <div
      className="absolute top-0 left-0 w-full h-full z-50"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    />
  );
}
