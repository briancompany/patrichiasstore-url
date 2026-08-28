import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

import("./App.tsx").then(({ default: App }) => {
  root.render(<App />);

  // Do not warm payment/staff edge functions during a customer's first paint.
  // Those functions are only useful for checkout/staff workflows and can be
  // warmed when those flows are actually opened.
});
