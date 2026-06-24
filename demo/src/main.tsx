import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./netGuard"; // patch fetch/XHR counters before anything else loads
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
