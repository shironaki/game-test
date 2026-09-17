import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  // Never fail silently with a white screen: explain what went wrong.
  const fallback = document.createElement("p");
  fallback.textContent = "Trap Adventure 2 could not start: the #root element is missing.";
  fallback.style.cssText =
    "font-family:monospace;color:#edf4ff;background:#0b0e16;padding:24px;margin:0;";
  document.body.appendChild(fallback);
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}
