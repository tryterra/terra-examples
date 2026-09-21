import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// StrictMode stays ON — the stream lifecycle in src/lib/stream.ts is written
// to survive its double-mount without bouncing the WebSocket.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
