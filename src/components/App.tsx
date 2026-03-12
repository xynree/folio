import React, { useState, useEffect } from "react";
import DropUtil from "./DropUtil/DropUtil";

interface FileWithPreview extends File {
  preview?: string;
}

export default function App() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);

  function callback(e: React.DragEvent<HTMLDivElement>) {
    const droppedFiles = Array.from(e.dataTransfer.files).map((file) => {
      // Create a blob URL for image files
      if (file.type.startsWith("image/")) {
        return Object.assign(file, {
          preview: URL.createObjectURL(file),
        });
      }
      return file;
    });

    setFiles((prev) => [...prev, ...droppedFiles]);
  }

  // Clean up object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [files]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4 backdrop-blur-2xl bg-red-400 p-2 rounded">
        folio - wip -
      </h1>
      <DropUtil callback={callback} />

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {files.map((f, index) => (
          <div
            key={`${f.name}-${index}`}
            className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-white shadow-sm"
          >
            {f.preview ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-md bg-gray-100">
                <img
                  src={f.preview}
                  alt={f.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="aspect-video w-full flex items-center justify-center bg-gray-100 rounded-md text-gray-400">
                No Preview
              </div>
            )}
            <div className="text-sm font-medium truncate">{f.name}</div>
            <div className="text-xs text-gray-500 uppercase">{f.type}</div>
            <div className="text-xs text-gray-400">
              {(f.size / 1024 / 1024).toFixed(2)} MB
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
