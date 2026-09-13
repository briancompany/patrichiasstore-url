import { createRoot } from "react-dom/client";
import "./index.css";
import { registerServiceWorker } from "./lib/register-service-worker";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Application root is unavailable");
}

const root = createRoot(rootElement);

import("./App.tsx").then(({ default: App }) => {
  root.render(<App />);

  // Do not warm payment/staff edge functions during a customer's first paint.
  // Those functions are only useful for checkout/staff workflows and can be
  // warmed when those flows are actually opened.
});

void registerServiceWorker();
