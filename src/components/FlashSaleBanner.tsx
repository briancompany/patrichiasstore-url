import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Zap, ChevronRight } from 'lucide-react';
import {
  useFlashSales,
  flashDiscount,
  flashSoldPercent,
  isLimitedFlashStock,
  type FlashSale,
} from '@/lib/flash-sales';
import { FlashCountdown } from '@/components/FlashCountdown';

interface FlashProduct {
  id: string;
  name: string;
  image_url: string | null;
  type: string;
}

/**
 * Jumia-style "Flash Sales — Live Now" rail. Shows live sales only, with a
 * countdown, discount badge and remaining sale stock.
 */
export function FlashSaleBanner({ compact = false }: { compact?: boolean }) {
  const { sales, loaded, refresh } = useFlashSales();
  const [products, setProducts] = useState<Record<string, FlashProduct>>({});

  const productIds = useMemo(() => sales.map((s) => s.product_id), [sales]);

  useEffect(() => {
    if (productIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, image_url, type')
        .in('id', productIds);
      if (cancelled || !data) return;
      const map: Record<string, FlashProduct> = {};
      data.forEach((p) => { map[p.id] = p as FlashProduct; });
      setProducts(map);
    })();
    return () => { cancelled = true; };
  }, [productIds.join(',')]);

  if (!loaded || sales.length === 0) return null;

  const soonest = sales.reduce<FlashSale>(
    (acc, s) => (new Date(s.ends_at) < new Date(acc.ends_at) ? s : acc),
    sales[0],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-secondary/40 bg-primary shadow-lg">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-primary px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
            <Zap className="h-4 w-4 text-secondary-foreground" />
          </span>
          <div>
            <h2 className="text-base font-extrabold uppercase tracking-wide text-primary-foreground sm:text-lg">
              Flash Sales
            </h2>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-secondary">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-secondary" />
              Live now
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary-foreground/70">
              Ends in
            </p>
            <FlashCountdown
              endsAt={soonest.ends_at}
              onEnd={refresh}
              className="rounded-md bg-secondary px-2 py-0.5 text-secondary-foreground"
              showIcon={false}
            />
          </div>
          {!compact && (
            <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
              <Link to="/shop">
                See all <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Rail */}
      <div className="bg-background p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sales.slice(0, compact ? 4 : 8).map((sale) => {
            const product = products[sale.product_id];
            const discount = flashDiscount(sale);
            const limited = isLimitedFlashStock(sale);
            return (
              <Link
                key={sale.flash_sale_id}
                to={`/shop/product/${sale.product_id}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md"
              >
                <div className="relative aspect-square bg-muted">
                  {product?.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                      No photo
                    </div>
                  )}
                  <span className="absolute left-2 top-2 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-destructive-foreground shadow">
                    Flash Sale
                  </span>
                  {discount > 0 && (
                    <span className="absolute right-2 top-2 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-extrabold text-secondary-foreground shadow">
                      -{discount}%
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                  <p className="line-clamp-2 text-xs font-semibold text-foreground sm:text-sm">
                    {sale.title || product?.name || 'Uniform item'}
                  </p>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-extrabold text-destructive sm:text-base">
                      Ksh {sale.sale_price.toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground line-through">
                      Ksh {sale.original_price.toLocaleString()}
                    </span>
                  </div>
                  {limited ? (
                    <div className="mt-auto space-y-1">
                      <Progress value={flashSoldPercent(sale)} className="h-1.5" />
                      <p className="text-[11px] font-bold text-primary">
                        Only {sale.remaining} left
                      </p>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="mt-auto w-fit text-[10px]">
                      While stock lasts
                    </Badge>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
