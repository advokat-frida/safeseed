import { createRoot } from "react-dom/client";
import "../index.css";
import "./proof.css";
import ProofPanel from "../components/ProofPanel";

// Panel-only build: just the interactive "See it for yourself" proof, no demo chrome.
// Embedded into the Advokat Frida article so the whole tool runs live in the page.
const el = document.getElementById("root");
if (el) createRoot(el).render(<ProofPanel />);
