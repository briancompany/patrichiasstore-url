import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart, Zap } from 'lucide-react';
import { ProductReviews } from '@/components/ProductReviews';
import { WishlistButton } from '@/components/WishlistButton';
import { useWishlist } from '@/hooks/useWishlist';
import { SizeGuide } from '@/components/SizeGuide';
import { BackInStockNotify } from '@/components/BackInStockNotify';
import { StockBadge } from '@/components/StockBadge';
import { ProductEnquiryButtons } from '@/components/ProductEnquiryButtons';
import { getStockInfo } from '@/lib/stock';
import { Progress } from '@/components/ui/progress';
import { FlashCountdown } from '@/components/FlashCountdown';
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
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);
  const { toggle, isWishlisted } = useWishlist();

  const stock = getStockInfo(product.stockQuantity, product.inStock);
  const limitedSale = sale ? isLimitedFlashStock(sale) : false;
  const saleRemaining = sale && limitedSale ? sale.remaining : Number.POSITIVE_INFINITY;
  const saleActive = !!sale && saleRemaining > 0;
  const maxQty = Math.min(stock.max, saleActive ? saleRemaining : Number.POSITIVE_INFINITY);
  const soldOut = !stock.orderable;
  const unitPrice = saleActive ? sale!.sale_price : selectedSize.price;
  const totalPrice = unitPrice * quantity;

  const handleQuantityChange = (delta: number) => {
    const max = Number.isFinite(maxQty) && maxQty > 0 ? maxQty : 1;
    const next = Math.min(max, Math.max(1, quantity + delta));
    if (delta > 0 && next === quantity && Number.isFinite(maxQty)) {
      return;
    }
    setQuantity(next);
  };

  const handleAddToCart = () => {
    if (soldOut) return;
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
    <div className="card-product">
      <div className="aspect-square bg-muted relative overflow-hidden">
        <WishlistButton
          isWishlisted={isWishlisted(product.id)}
          onToggle={() => toggle(product.id)}
        />
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
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
              SOLD OUT
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
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
          <p className="text-sm text-muted-foreground">{typeLabels[product.type]}</p>
        </div>

        {/* Live availability */}
        <StockBadge quantity={product.stockQuantity} inStock={product.inStock} />

        {/* Out of stock notification */}
        {soldOut && (
          <BackInStockNotify productId={product.id} productName={product.name} />
        )}

        {/* Size Selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Size:</p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size.size}
                onClick={() => setSelectedSize(size)}
                className={`badge-size ${
                  selectedSize.size === size.size
                    ? 'badge-size-active'
                    : 'badge-size-inactive'
                }`}
              >
                {size.size}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Quantity:</p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleQuantityChange(-1)}
              disabled={soldOut}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-semibold w-8 text-center">{quantity}</span>
            <button
              onClick={() => handleQuantityChange(1)}
              disabled={soldOut || quantity >= maxQty}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Flash sale details */}
        {saleActive && (
          <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
            <div className="flex items-center justify-between gap-2">
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
          disabled={soldOut}
          className="w-full btn-secondary gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          {soldOut ? 'Sold Out' : 'Add to Order'}
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
