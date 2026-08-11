import { AlertTriangle, CheckCircle2, PackageX } from 'lucide-react';
import { getStockInfo } from '@/lib/stock';

interface StockBadgeProps {
  quantity?: number | null;
  inStock?: boolean;
  className?: string;
}

export function StockBadge({ quantity, inStock = true, className = '' }: StockBadgeProps) {
  const info = getStockInfo(quantity, inStock);

  if (info.status === 'out') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-xs font-bold uppercase tracking-wide text-destructive-foreground shadow-sm ${className}`}
      >
        <PackageX className="h-3.5 w-3.5" />
        Out of stock · Restocking soon
      </span>
    );
  }

  if (info.status === 'low' || info.status === 'few') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary-foreground shadow-sm ${className}`}
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        {info.label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary ${className}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      In stock
    </span>
  );
}