import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./generator.css";
import Generator from "./Generator";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Generator />
  </StrictMode>,
);
