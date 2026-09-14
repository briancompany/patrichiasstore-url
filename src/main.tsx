import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { registerServiceWorker } from "./lib/register-service-worker";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root is unavailable");
}

const root = createRoot(rootElement);

root.render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);

window.addEventListener("load", () => {
  void registerServiceWorker().catch((error) => {
    console.error("Service worker setup failed", error);
  });
});
