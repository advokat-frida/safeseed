import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../netGuard"; // patch fetch/XHR counters before anything else loads
import "../index.css";
import "./generator.css";
import Generator from "./Generator";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Generator />
  </StrictMode>,
);
