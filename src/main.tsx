import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

import("./App.tsx").then(({ default: App }) => {
  root.render(<App />);

  import("./lib/warmup").then(({ warmupEdgeFunctions }) => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => warmupEdgeFunctions());
    } else {
      globalThis.setTimeout(warmupEdgeFunctions, 2000);
    }
  });
});
