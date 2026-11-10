// Anonymous first-party visitor tracking. Events are written through a
// narrowly scoped database RPC so recording does not depend on an Edge Function.
import { supabase } from "@/integrations/supabase/client";

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
const MAX_BATCH = 40;
const INTERNAL_PREFIX = ["/admin", "/staff"];

let queue: EventPayload[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let initialised = false;
let flushing = false;

let currentPage = "";
let pageEnteredAt = 0;
let maxScrollPct = 0;

function randomId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function isInternal(): boolean {
  return INTERNAL_PREFIX.some((p) => location.pathname.startsWith(p));
}

function getVisitorId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return randomId();
  }
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
  if (/Mobi|iPhone|Android/i.test(ua) || ((navigator.maxTouchPoints ?? 0) > 1 && window.innerWidth < 700)) return "mobile";
  return "desktop";
}

function referrerHost(): string | undefined {
  try {
    return document.referrer ? new URL(document.referrer).hostname : undefined;
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

async function send(batch: EventPayload[]): Promise<void> {
  if (!batch.length) return;
  const { error } = await supabase.rpc("record_visitor_events", {
    _events: batch as never,
  });
  if (error) throw error;
}

async function flush(): Promise<void> {
  if (flushing || queue.length === 0) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }

  flushing = true;
  const batch = queue.splice(0, MAX_BATCH);
  try {
    await send(batch);
  } catch (error) {
    // Keep failed events for a later retry instead of silently discarding them.
    queue = [...batch, ...queue].slice(-MAX_QUEUE);
    console.warn("Visitor analytics could not be saved; will retry.", error);
  } finally {
    flushing = false;
    if (queue.length) {
      timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
    }
  }
}

function schedule(): void {
  if (queue.length >= FLUSH_SIZE) {
    void flush();
  } else if (!timer) {
    timer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

function track(
  type: string,
  fields: Omit<EventPayload, "type" | "visitorId" | "sessionId" | "deviceType" | "referrer"> = {},
): void {
  if (!initialised || isInternal() || !navigator.onLine) return;
  if (queue.length >= MAX_QUEUE) queue = queue.slice(-Math.floor(MAX_QUEUE / 2));
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

  // Track React Router history transitions, including back/forward navigation.
  const wrap = (fn: History["pushState"]) =>
    function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = fn.apply(this, args);
      openPage();
      return result;
    };
  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", openPage);

  window.addEventListener("scroll", () => {
    const pct = scrollPct();
    if (pct > maxScrollPct) maxScrollPct = pct;
  }, { passive: true });

  document.addEventListener("pointerdown", (e) => {
    if (isInternal()) return;
    const target = e.target as HTMLElement | null;
    const el = target?.closest?.("a, button, [role='button'], input, label, select");
    const waLink = (target?.closest?.("a") as HTMLAnchorElement | null)?.href?.includes("wa.me");
    if (waLink) track("whatsapp_click");
    if (!el) return;

    const doc = document.documentElement;
    const pageW = Math.max(1, doc.clientWidth);
    const pageH = Math.max(1, doc.scrollHeight);
    track("click", {
      xPct: Math.max(0, Math.min(100, Math.round((e.clientX / pageW) * 100))),
      yPct: Math.max(0, Math.min(100, Math.round(((window.scrollY + e.clientY) / pageH) * 100))),
      meta: {
        tag: el.tagName?.toLowerCase() ?? "",
        text: (el.textContent ?? "").trim().slice(0, 60),
      },
    });
  }, { passive: true });

  const originalOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (!isInternal() && String(url ?? "").includes("wa.me")) track("whatsapp_click");
    return originalOpen(url, target, features);
  }) as typeof window.open;

  const onHide = () => {
    closePage();
    void flush();
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") onHide();
  });
  window.addEventListener("online", () => void flush());
}
