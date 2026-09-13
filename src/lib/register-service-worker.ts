import { registerSW } from "virtual:pwa-register";

const APP_WORKER_PATH = "/sw.js";

function isPreviewHost(hostname: string) {
  return (
    hostname.startsWith("id-preview--") ||
    hostname.startsWith("preview--") ||
    hostname === "lovableproject.com" ||
    hostname.endsWith(".lovableproject.com") ||
    hostname === "lovableproject-dev.com" ||
    hostname.endsWith(".lovableproject-dev.com") ||
    hostname === "beta.lovable.dev" ||
    hostname.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppWorker() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    registrations.map((registration) => {
      const workerUrl =
        registration.active?.scriptURL ??
        registration.waiting?.scriptURL ??
        registration.installing?.scriptURL;

      if (!workerUrl || new URL(workerUrl).pathname !== APP_WORKER_PATH) {
        return Promise.resolve(false);
      }

      return registration.unregister();
    }),
  );
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const isEmbedded = window.self !== window.top;
  const disabled = new URLSearchParams(window.location.search).get("sw") === "off";
  const shouldRefuse = !import.meta.env.PROD || isEmbedded || isPreviewHost(window.location.hostname) || disabled;

  if (shouldRefuse) {
    await unregisterAppWorker();
    return;
  }

  registerSW({ immediate: true });
}