import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, Zap, Ruler } from 'lucide-react';
import { ProductReviews } from '@/components/ProductReviews';
import { WishlistButton } from '@/components/WishlistButton';
import { useWishlist } from '@/hooks/useWishlist';
import { SizeGuide } from '@/components/SizeGuide';
import { BackInStockNotify } from '@/components/BackInStockNotify';
import { StockBadge } from '@/components/StockBadge';
import { ProductEnquiryButtons } from '@/components/ProductEnquiryButtons';
import { ProductImageZoom } from '@/components/ProductImageZoom';
import { getStockInfo } from '@/lib/stock';
import { Progress } from '@/components/ui/progress';
import { FlashCountdown } from '@/components/FlashCountdown';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePricingChart } from '@/hooks/useProductCache';
import {
  flashDiscount,
  flashSoldPercent,
  isLimitedFlashStock,
  type FlashSale,
} from '@/lib/flash-sales';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, size: string, quantity: number, price: number) => void;
  /** Live flash sale for this product, when one is running. */
  sale?: FlashSale;
}

export function ProductCard({ product, onAddToCart, sale }: ProductCardProps) {
  const pricingChart = usePricingChart();
  const chartSizes = (pricingChart[product.type] || []).map((entry) => ({
    ...entry,
    stock: product.sizes.find((size) => size.size === entry.size)?.stock,
  }));
  const effectiveSizes = chartSizes.length ? chartSizes : product.sizes;
  const [selectedSize, setSelectedSize] = useState(effectiveSizes[0]);
  const [sizeDialogOpen, setSizeDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    const current = effectiveSizes.find((size) => size.size === selectedSize?.size);
    setSelectedSize(current || effectiveSizes[0]);
  }, [product.id, chartSizes, product.sizes, selectedSize?.size]);
  const { toggle, isWishlisted } = useWishlist();

  const hasCompleteSizeStock = chartSizes.length > 0 && product.sizes.length === chartSizes.length && chartSizes.every(
    (size) => Number.isSafeInteger(size.stock) && Number(size.stock) >= 0,
  );
  const selectedSizeStock = hasCompleteSizeStock ? selectedSize?.stock : product.stockQuantity;
  const stock = getStockInfo(selectedSizeStock, product.inStock);
  const limitedSale = sale ? isLimitedFlashStock(sale) : false;
  const saleRemaining = sale && limitedSale ? sale.remaining : Number.POSITIVE_INFINITY;
  const saleActive = !!sale && saleRemaining > 0;
  const maxQty = saleActive ? Math.min(saleRemaining, stock.max) : stock.max;
  const soldOut = !stock.orderable;
  const unitPrice = saleActive ? sale!.sale_price : (selectedSize?.price ?? effectiveSizes[0]?.price ?? 0);
  const startingPrice = effectiveSizes.length ? Math.min(...effectiveSizes.map((size) => Number(size.price) || 0)) : 0;
  const totalPrice = unitPrice * quantity;

  const handleQuantityChange = (delta: number) => {
    const max = Number.isFinite(maxQty) ? maxQty : 9999;
    setQuantity(Math.min(max, Math.max(1, quantity + delta)));
  };

  const handleAddToCart = () => {
    if (!selectedSize) return;
    onAddToCart(product, selectedSize.size, quantity, totalPrice);
  };

  const typeLabels: Record<string, string> = {
    tshirt: 'T-Shirt',
    shirts: 'Shirts',
    tracksuit: 'Tracksuit',
    socks: 'Socks',
    shorts: 'Shorts',
    trousers: 'Trousers',
    skirt: 'Skirt',
    sweater: 'Sweater',
    tie: 'Tie',
    dress: 'Dress',
    fleece_jacket: 'Fleece Jacket',
    other: 'Uniform',
  };

  return (
    <div className={`card-product overflow-hidden rounded-[1.35rem] border border-white/80 shadow-md ${product.id.charCodeAt(product.id.length - 1) % 2 === 0 ? 'bg-emerald-50/90' : 'bg-sky-50/90'}`}>
      <div className="aspect-square bg-white relative overflow-hidden rounded-t-[1.3rem] p-1">
        <WishlistButton
          isWishlisted={isWishlisted(product.id)}
          onToggle={() => toggle(product.id)}
        />
        <ProductImageZoom src={product.image} alt={product.name} className="h-full aspect-square" />
        {saleActive && (
          <>
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-destructive-foreground shadow">
              <Zap className="h-3 w-3" /> Flash Sale
            </span>
            {flashDiscount(sale!) > 0 && (
              <span className="absolute right-2 bottom-2 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-extrabold text-secondary-foreground shadow">
                -{flashDiscount(sale!)}%
              </span>
            )}
          </>
        )}
        {!product.inStock && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full font-medium">
              SPECIAL ORDER AVAILABLE
            </span>
          </div>
        )}
      </div>

      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-1 rounded-full">
            {product.school}
          </span>
          <SizeGuide type={product.type} />
        </div>
        
        <div>
          <h3 className="font-semibold text-lg text-foreground">
            <Link
              to={`/shop/product/${product.id}`}
              className="hover:underline focus-visible:underline"
            >
              {product.name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{typeLabels[product.type] || product.type.replace(/_/g, ' ')}</p>
          {startingPrice > 0 && <p className="mt-1 text-sm font-semibold text-foreground">From KSh {startingPrice.toLocaleString('en-KE')}</p>}
        </div>

        {/* Live availability */}
        <StockBadge quantity={selectedSizeStock} inStock={product.inStock} />

        {/* Out of stock notification */}
        {soldOut && (
          <BackInStockNotify productId={product.id} productName={product.name} />
        )}

        {/* Shared size and price chart */}
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background/80 p-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Selected size</p>
            <p className="font-semibold">{selectedSize?.size || 'Choose a size'}</p>
            <p className="text-sm font-bold text-foreground">KSh {(selectedSize?.price ?? 0).toLocaleString('en-KE')}</p>
          </div>
          <Dialog open={sizeDialogOpen} onOpenChange={setSizeDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-2">
                <Ruler className="h-4 w-4" />
                View sizes & prices
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>{product.name} — Sizes & prices</DialogTitle>
              </DialogHeader>
              <div className="max-h-[55vh] space-y-2 overflow-y-auto">
                {effectiveSizes.map((size) => (
                  <button
                    type="button"
                    key={size.size}
                    onClick={() => { setSelectedSize(size); setQuantity(1); setSizeDialogOpen(false); }}
                    className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                      selectedSize?.size === size.size
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="font-medium">{size.size}</span>
                    <span className="font-bold">KSh {Number(size.price).toLocaleString('en-KE')}</span>
                  </button>
                ))}
                {effectiveSizes.length === 0 && (
                  <p className="text-sm text-muted-foreground">Size options are not available yet. Please contact the store.</p>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Quantity */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Quantity:</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <input
              type="number"
              min={1}
              max={Number.isFinite(maxQty) ? maxQty : 9999}
              value={quantity}
              onChange={(e) => {
                const value = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(value)) setQuantity(Math.min(Number.isFinite(maxQty) ? maxQty : 9999, Math.max(1, value)));
              }}
              className="font-semibold w-14 text-center rounded-md border border-border bg-background py-1"
              aria-label="Quantity"
            />
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={quantity >= maxQty}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Flash sale details */}
        {saleActive && (
          <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-destructive">
                <Zap className="h-3 w-3" /> Sale ends in
              </span>
              <FlashCountdown endsAt={sale!.ends_at} className="text-destructive" showIcon={false} />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-extrabold text-destructive">
                Ksh {sale!.sale_price.toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground line-through">
                Ksh {sale!.original_price.toLocaleString()}
              </span>
            </div>
            {limitedSale && (
              <>
                <Progress value={flashSoldPercent(sale!)} className="h-1.5" />
                <p className="text-[11px] font-bold text-primary">Only {sale!.remaining} left at this price</p>
              </>
            )}
          </div>
        )}

        {/* Price */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="price-tag">Ksh {totalPrice.toLocaleString()}</span>
        </div>


        {/* Add to Cart */}
        <Button
          onClick={handleAddToCart}
          disabled={!selectedSize}
          className="w-full btn-secondary gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          {soldOut ? 'Add as Special Order' : 'Add to Order'}
        </Button>

        {soldOut && (
          <p className="text-xs text-muted-foreground text-center">
            Restocking soon — in a hurry? Message or call us to reserve yours.
          </p>
        )}

        {/* Enquire about this item */}
        <ProductEnquiryButtons
          productName={product.name}
          size={selectedSize?.size}
          school={product.school}
          imageUrl={product.image}
          soldOut={soldOut}
        />

        {/* Reviews */}
        <ProductReviews productId={product.id} productName={product.name} />
      </div>
    </div>
  );
}
