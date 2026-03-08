import { useState } from 'react';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Minus, Plus, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, size: string, quantity: number, price: number) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [selectedSize, setSelectedSize] = useState(product.sizes[0]);
  const [quantity, setQuantity] = useState(1);

  const totalPrice = selectedSize.price * quantity;

  const handleQuantityChange = (delta: number) => {
    setQuantity(Math.max(1, quantity + delta));
  };

  const handleAddToCart = () => {
    onAddToCart(product, selectedSize.size, quantity, totalPrice);
  };

  const typeLabels: Record<string, string> = {
    tshirt: 'T-Shirt',
    tracksuit: 'Tracksuit',
    socks: 'Socks',
    shorts: 'Shorts',
    skirt: 'Skirt',
    sweater: 'Sweater',
  };

  return (
    <div className="card-product">
      <div className="aspect-square bg-muted relative overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover"
          loading="lazy"
          decoding="async"
        />
        {!product.inStock && (
          <div className="absolute inset-0 bg-foreground/50 flex items-center justify-center">
            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded-full font-medium">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div>
          <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-1 rounded-full">
            {product.school}
          </span>
        </div>
        
        <div>
          <h3 className="font-semibold text-lg text-foreground">{product.name}</h3>
          <p className="text-sm text-muted-foreground">{typeLabels[product.type]}</p>
        </div>

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
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="font-semibold w-8 text-center">{quantity}</span>
            <button
              onClick={() => handleQuantityChange(1)}
              className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="price-tag">Ksh {totalPrice.toLocaleString()}</span>
        </div>

        {/* Add to Cart */}
        <Button
          onClick={handleAddToCart}
          disabled={!product.inStock}
          className="w-full btn-secondary gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Add to Order
        </Button>
      </div>
    </div>
  );
}
