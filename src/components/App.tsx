import React, { useState } from "react";
import DropUtil from "./DropUtil/DropUtil";

export default function App() {
  const [files, setFiles] = useState([]);
  function callback(e: React.DragEvent<HTMLDivElement>) {
    console.log(e);
    setFiles(Array.from(e.dataTransfer.files));
    console.log(e.dataTransfer.files);
  }
  return (
    <div>
      <h1 className="backdrop-blur-2xl bg-red-400">folio - wip-</h1>
      <DropUtil callback={callback} />

      <div className="flex flex-col gap-4">
        {files.map((f: File) => (
          <div key={f.name} className="flex flex-col gap-1">
            <div>{f.name}</div>
            <div>{f.type}</div>
            <div>{f.size}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
