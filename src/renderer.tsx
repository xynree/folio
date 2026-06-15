import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./components/App";
import React from "react";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
