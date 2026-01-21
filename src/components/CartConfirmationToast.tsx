import { CheckCircle, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface CartConfirmationOptions {
  productName: string;
  quantity: number;
  totalPrice: number;
  cartCount: number;
}

export function showCartConfirmation({ productName, quantity, totalPrice, cartCount }: CartConfirmationOptions) {
  toast.custom(
    (t) => (
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-3 min-w-[300px]">
        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
          <CheckCircle className="h-5 w-5 text-success" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Added to Cart!</p>
          <p className="text-sm text-muted-foreground">
            {productName} × {quantity}
          </p>
          <p className="text-sm font-medium text-primary">
            Ksh {totalPrice.toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-accent">
          <ShoppingCart className="h-4 w-4" />
          {cartCount}
        </div>
      </div>
    ),
    {
      duration: 3000,
      position: 'top-center',
    }
  );
}