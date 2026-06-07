import { createRoot } from "react-dom/client";
import "./index.css";

const requiredEnvVars = [
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
] as const;

const missingEnvVars = requiredEnvVars.filter((key) => !import.meta.env[key]);
const root = createRoot(document.getElementById("root")!);

function MissingEnvironmentScreen() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
        <p className="text-sm font-semibold text-primary">Patrichia&apos;s Store setup</p>
        <h1 className="mt-2 text-2xl font-bold">Vercel environment variables are missing</h1>
        <p className="mt-3 text-muted-foreground">
          Add these three publishable Lovable Cloud variables in Vercel, then redeploy.
        </p>
        <ul className="mt-5 space-y-2 text-sm font-medium">
          {missingEnvVars.map((key) => (
            <li key={key} className="rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
              {key}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

if (missingEnvVars.length > 0) {
  root.render(<MissingEnvironmentScreen />);
} else {
  import("./App.tsx").then(({ default: App }) => {
    root.render(<App />);

    import("./lib/warmup").then(({ warmupEdgeFunctions }) => {
      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(() => warmupEdgeFunctions());
      } else {
        window.setTimeout(warmupEdgeFunctions, 2000);
      }
    });
  });
}
