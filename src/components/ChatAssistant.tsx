import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, X, Send, Loader2, ShoppingBag, RotateCcw, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { STORAGE_KEYS, storageSet } from '@/lib/persist';
import type { CartItem } from '@/types/product';

type Card =
  | { type: 'order'; items: CartItem[]; total: number }
  | { type: 'whatsapp'; url: string };
interface Msg { role: 'user' | 'assistant'; content: string; cards?: Card[] }

const DEVICE_KEY = 'ps_chat_device_v1';
function deviceToken() {
  let t = localStorage.getItem(DEVICE_KEY);
  if (!t) {
    t = crypto.randomUUID() + crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, t);
  }
  return t;
}

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('ai-chat', { body: { deviceToken: deviceToken(), ...body } });
  if (error) {
    let msg = 'Sorry, something went wrong. Please try again, or call 0726 075 180.';
    try {
      const j = await (error as { context?: Response }).context?.json();
      if (j?.error) msg = j.error;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data;
}

export function ChatAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<'idle' | 'choose' | 'chat'>('idle');
  const [prev, setPrev] = useState<{ id: string; messages: Msg[] } | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const toMsgs = (rows: { role: string; content: string; meta?: { cards?: Card[] } }[]) =>
    rows.map((r) => ({ role: r.role as Msg['role'], content: r.content, cards: r.meta?.cards }));

  async function openPanel() {
    setOpen(true);
    if (stage !== 'idle') return;
    setBusy(true);
    try {
      const r = await call({ action: 'resume' });
      if (r?.session) {
        setPrev({ id: r.session.id, messages: toMsgs(r.messages ?? []) });
        setStage('choose');
      } else await startNew();
    } catch (e) {
      setErr((e as Error).message);
      setStage('chat');
    } finally { setBusy(false); }
  }

  async function startNew() {
    if (sessionId && messages.length) call({ action: 'end', sessionId }).catch(() => {});
    else if (prev) call({ action: 'end', sessionId: prev.id }).catch(() => {});
    setBusy(true);
    try {
      const r = await call({ action: 'new' });
      setSessionId(r.session.id);
      setMessages([]);
      setErr(null);
      setStage('chat');
    } catch (e) { setErr((e as Error).message); setStage('chat'); }
    finally { setBusy(false); }
  }

  function continuePrev() {
    if (!prev) return;
    setSessionId(prev.id);
    setMessages(prev.messages);
    setStage('chat');
  }

  async function send() {
    const text = input.trim();
    if (!text || busy || !sessionId) return;
    setInput('');
    setErr(null);
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setBusy(true);
    try {
      const r = await call({ action: 'send', sessionId, message: text });
      setMessages((m) => [...m, { role: 'assistant', content: r.reply, cards: r.cards }]);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  function close() {
    setOpen(false);
    if (sessionId && messages.length) call({ action: 'end', sessionId }).catch(() => {});
  }

  function checkout(items: CartItem[]) {
    storageSet(STORAGE_KEYS.shopCart, items);
    setOpen(false);
    navigate('/order', { state: { cart: items } });
  }

  return (
    <>
      {!open && (
        <button
          onClick={openPanel}
          aria-label="Chat with Patrichia, our shop assistant"
          className="fixed bottom-24 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-accent transition-transform hover:scale-105"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[78vh] max-h-[640px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl animate-in slide-in-from-bottom-8 sm:inset-x-auto sm:right-4 sm:w-[380px]">
          <div className="flex items-center justify-between bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent font-bold text-accent-foreground">P</div>
              <div>
                <p className="text-sm font-semibold leading-tight">Patrichia</p>
                <p className="text-xs opacity-80">Uniform assistant · English / Kiswahili</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {stage === 'chat' && (
                <button onClick={startNew} aria-label="Start new chat" className="rounded p-1.5 hover:bg-primary-foreground/10">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button onClick={close} aria-label="Close chat" className="rounded p-1.5 hover:bg-primary-foreground/10">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3">
            {stage === 'choose' && (
              <div className="space-y-3 pt-6 text-center">
                <p className="text-sm text-muted-foreground">Welcome back! What would you like to do?</p>
                <Button className="w-full gap-2" onClick={continuePrev}><History className="h-4 w-4" />Continue last conversation</Button>
                <Button variant="outline" className="w-full gap-2" onClick={startNew}><RotateCcw className="h-4 w-4" />Start new chat</Button>
              </div>
            )}

            {stage === 'chat' && messages.length === 0 && !busy && (
              <div className="rounded-xl bg-muted p-3 text-sm">
                Hello! 👋 I'm Patrichia. Ask me about uniforms, prices, sizes, your school, or track an order. <br />
                <span className="text-muted-foreground">Habari! Uliza kuhusu sare, bei au oda yako.</span>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'flex justify-end' : ''}>
                {m.role === 'user' ? (
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</div>
                ) : (
                  <div className="max-w-[95%] space-y-2">
                    <div className="prose prose-sm max-w-none text-foreground prose-p:my-1 prose-ul:my-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                    {m.cards?.map((c, j) =>
                      c.type === 'order' ? (
                        <div key={j} className="rounded-xl border-2 border-accent bg-card p-3 text-sm">
                          <p className="mb-1 font-semibold">Your order</p>
                          {c.items.map((it, k) => (
                            <p key={k} className="flex justify-between gap-2">
                              <span>{it.quantity}× {it.product.name} ({it.selectedSize})</span>
                              <span>Ksh {it.price.toLocaleString()}</span>
                            </p>
                          ))}
                          <p className="mt-1 flex justify-between border-t pt-1 font-bold"><span>Total</span><span>Ksh {c.total.toLocaleString()}</span></p>
                          <Button size="sm" className="mt-2 w-full gap-2" onClick={() => checkout(c.items)}>
                            <ShoppingBag className="h-4 w-4" />Continue to payment
                          </Button>
                        </div>
                      ) : (
                        <a key={j} href={c.url} target="_blank" rel="noopener noreferrer"
                          className="block rounded-xl border bg-card p-2 text-center text-sm font-medium text-primary underline">
                          Talk to us on WhatsApp
                        </a>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}

            {busy && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Patrichia is typing…</div>}
            {err && <div className="rounded-lg border border-destructive bg-destructive/10 p-2 text-sm text-destructive">{err}</div>}
            <div ref={endRef} />
          </div>

          {stage === 'chat' && (
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-end gap-2 border-t p-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 1000))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Type your message…"
                rows={1}
                className="max-h-28 min-h-[42px] resize-none"
                aria-label="Message"
              />
              <Button type="submit" size="icon" disabled={busy || !input.trim() || !sessionId} aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}
        </div>
      )}
    </>
  );
}
