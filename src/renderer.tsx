import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./components/App";

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
