// Anonymous first-party visitor tracking. No third-party scripts, no PII:
// stores a random visitor id in localStorage, never names, phones or emails.
type EventPayload = {
  type: string;
  visitorId: string;
  sessionId: string;
  page?: string;
  school?: string;
  productId?: string;
  xPct?: number;
  yPct?: number;
  deviceType?: "mobile" | "desktop" | "tablet";
  referrer?: string;
  seconds?: number;
  scrollPct?: number;
  meta?: Record<string, string | number | boolean | null>;
};

const STORAGE_KEY = "ps_visitor_id";
const SESSION_KEY = "ps_visitor_session";
const FLUSH_SIZE = 8;
const FLUSH_INTERVAL_MS = 5000;
const MAX_QUEUE = 60;
const INTERNAL_PREFIX = ["/admin", "/staff"];

let queue: EventPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;

let currentPage = "";
let pageEnteredAt = 0;
let maxScrollPct = 0;

const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-event`;
const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isInternal(): boolean {
  return INTERNAL_PREFIX.some((p) => location.pathname.startsWith(p));
}

function getVisitorId(): string {
  let id: string | null = null;
  try {
    id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(STORAGE_KEY, id);
    }
  } catch {
    id = id ?? randomId();
  }
  return id;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
}

function deviceType(): "mobile" | "desktop" | "tablet" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/Mobi|iPhone|Android/i.test(ua) || (navigator.maxTouchPoints ?? 0) > 1 && window.innerWidth < 700) return "mobile";
  return "desktop";
}

function referrerHost(): string | undefined {
  try {
    const r = document.referrer;
    if (!r) return undefined;
    return new URL(r).hostname;
  } catch {
    return undefined;
  }
}

function scrollPct(): number {
  const doc = document.documentElement;
  const total = doc.scrollHeight - window.innerHeight;
  if (total <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / total) * 100)));
}

function send(batch: EventPayload[], keepalive = false): void {
  if (!batch.length || !anonKey) return;
  const body = JSON.stringify({ events: batch.slice(0, MAX_QUEUE) });
  try {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey },
      body,
      keepalive,
      // never block or surface errors
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length) {
    send(queue, false);
    queue = [];
  }
}

function schedule(): void {
  if (queue.length >= FLUSH_SIZE) flush();
  else if (!timer) timer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function track(
  type: string,
  fields: Omit<EventPayload, "type" | "visitorId" | "sessionId" | "deviceType" | "referrer"> = {},
): void {
  if (!initialised || isInternal() || !navigator.onLine) return;
  if (queue.length >= MAX_QUEUE) queue = queue.slice(-MAX_QUEUE / 2);
  queue.push({
    type,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    page: location.pathname + location.search,
    deviceType: deviceType(),
    referrer: referrerHost(),
    ...fields,
  });
  schedule();
}

function closePage(): void {
  if (!currentPage || pageEnteredAt === 0) return;
  const seconds = Math.min(24 * 3600, Math.round((Date.now() - pageEnteredAt) / 1000));
  if (seconds >= 3 || maxScrollPct >= 10) {
    track("time_on_page", { seconds, scrollPct: maxScrollPct, meta: { from: currentPage } });
  }
  currentPage = "";
  pageEnteredAt = 0;
  maxScrollPct = 0;
}

function openPage(): void {
  closePage();
  if (isInternal()) return;
  currentPage = location.pathname + location.search;
  pageEnteredAt = Date.now();
  maxScrollPct = scrollPct();
  track("page_view");
}

export function trackVisitorEvent(
  type: string,
  fields: { school?: string; productId?: string; meta?: Record<string, string | number | boolean | null> } = {},
): void {
  track(type, fields);
}

export function initVisitorTracking(): void {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  openPage();

  // SPA route changes (react-router uses pushState/replaceState)
  const wrap = (fn: History["pushState"]) =>
    function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = fn.apply(this, args);
      openPage();
      return result;
    };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", openPage);

  // Scroll depth
  window.addEventListener(
    "scroll",
    () => {
      const pct = scrollPct();
      if (pct > maxScrollPct) maxScrollPct = pct;
    },
    { passive: true },
  );

  // Click positions as % of the page; also catch WhatsApp clicks anywhere
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (isInternal()) return;
      const target = e.target as HTMLElement | null;
      const el = target?.closest?.("a, button, [role='button'], input, label, select");
      const waLink = (target?.closest?.("a") as HTMLAnchorElement | null)?.href?.includes("wa.me");
      if (waLink) track("whatsapp_click");
      if (!el) return;
      const doc = document.documentElement;
      const pageH = Math.max(1, doc.scrollHeight - window.innerHeight + window.innerHeight);
      const x = Math.round((e.clientX / Math.max(1, window.innerWidth)) * 100);
      const y = Math.min(100, Math.round((e.clientY / pageH) * 100));
      track("click", {
        xPct: x,
        yPct: y,
        meta: {
          tag: el.tagName?.toLowerCase() ?? "",
          text: (el.textContent ?? "").trim().slice(0, 60),
        },
      });
    },
    { passive: true },
  );

  // window.open calls (many WhatsApp/help buttons) that skip anchor clicks
  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (!isInternal() && String(url ?? "").includes("wa.me")) track("whatsapp_click");
    return originalOpen(url, target, features);
  }) as typeof window.open;

  // Flush when the tab hides or closes
  const onHide = () => {
    closePage();
    if (queue.length) {
      send(queue, true);
      queue = [];
    }
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });

  // Safety flush
  window.addEventListener("online", flush);
}
