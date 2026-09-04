import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { X, Zap } from 'lucide-react';
import { useFlashSales } from '@/lib/flash-sales';
import { FlashCountdown } from '@/components/FlashCountdown';

const DISMISS_KEY = 'ps_flash_alert_dismissed';

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * One-time in-app notification when a flash sale goes live. Dismissal is
 * remembered per sale so shoppers are never nagged twice for the same sale.
 */
export function FlashSaleAlert() {
  const { sales, loaded } = useFlashSales();
  const [dismissed, setDismissed] = useState<string[]>(() => readDismissed());

  const sale = sales.find((s) => !dismissed.includes(s.flash_sale_id));

  useEffect(() => {
    if (!sale) return;
    // Keep the stored list small — only track the sales we have shown.
    const ids = readDismissed();
    if (ids.length > 40) {
      try {
        localStorage.setItem(DISMISS_KEY, JSON.stringify(ids.slice(-20)));
      } catch { /* storage unavailable */ }
    }
  }, [sale?.flash_sale_id]);

  if (!loaded || !sale) return null;

  const dismiss = () => {
    const next = [...dismissed, sale.flash_sale_id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch { /* storage unavailable */ }
  };

  return (
    <div className="relative bg-primary px-4 py-2.5 text-primary-foreground">
      <div className="container-shop flex flex-wrap items-center justify-center gap-x-3 gap-y-1 pr-8 text-center">
        <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-secondary">
          <Zap className="h-4 w-4" />
          Flash sale live
        </span>
        <Link to={`/shop/product/${sale.product_id}`} className="text-sm font-semibold underline-offset-2 hover:underline">
          {sale.title || 'Limited-time uniform offer'} — Ksh {sale.sale_price.toLocaleString()}
        </Link>
        <FlashCountdown endsAt={sale.ends_at} className="text-secondary" />
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss flash sale notification"
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-primary-foreground/80 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
