import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { warmupEdgeFunctions } from "./lib/warmup";

createRoot(document.getElementById("root")!).render(<App />);

// Warm up critical edge functions after initial render
requestIdleCallback?.(() => warmupEdgeFunctions()) ?? setTimeout(warmupEdgeFunctions, 2000);
