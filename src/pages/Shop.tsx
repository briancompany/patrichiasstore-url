import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ProductCard';
import { products, schools, uniformTypes } from '@/data/products';
import { Product, CartItem } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingCart, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Shop() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const schoolMatch = selectedSchool === 'all' || product.school === selectedSchool;
      const typeMatch = selectedType === 'all' || product.type === selectedType;
      return schoolMatch && typeMatch;
    });
  }, [selectedSchool, selectedType]);

  const handleAddToCart = (product: Product, size: string, quantity: number, price: number) => {
    const existingIndex = cart.findIndex(
      (item) => item.product.id === product.id && item.selectedSize === size
    );

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
      newCart[existingIndex].price += price;
      setCart(newCart);
    } else {
      setCart([...cart, { product, selectedSize: size, quantity, price }]);
    }
    setShowCart(true);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const handleProceedToOrder = () => {
    navigate('/order', { state: { cart } });
  };

  const typeLabels: Record<string, string> = {
    all: 'All Types',
    tshirt: 'T-Shirts',
    tracksuit: 'Tracksuits',
    socks: 'Socks',
    shorts: 'Shorts',
    skirt: 'Skirts',
    sweater: 'Sweaters',
  };

  return (
    <Layout>
      <div className="container-shop py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Shop Uniforms</h1>
          <p className="text-muted-foreground">Browse our collection and add items to your order</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <Select value={selectedSchool} onValueChange={setSelectedSchool}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select School" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map((school) => (
                <SelectItem key={school} value={school}>
                  {school}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Select Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniformTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {typeLabels[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {cart.length > 0 && (
            <Button
              onClick={() => setShowCart(!showCart)}
              className="btn-secondary gap-2 sm:ml-auto"
            >
              <ShoppingCart className="h-4 w-4" />
              Cart ({cart.length})
            </Button>
          )}
        </div>

        {/* Cart Summary */}
        {showCart && cart.length > 0 && (
          <div className="mb-8 p-4 bg-card rounded-xl border border-border animate-fade-in">
            <h3 className="font-semibold text-lg mb-4 flex items-center justify-between">
              Your Order
              <button onClick={() => setShowCart(false)}>
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </h3>
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.product.school} • Size: {item.selectedSize} • Qty: {item.quantity}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">Ksh {item.price.toLocaleString()}</span>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border">
              <span className="font-semibold text-lg">Total:</span>
              <span className="price-tag text-xl">Ksh {cartTotal.toLocaleString()}</span>
            </div>
            <Button onClick={handleProceedToOrder} className="w-full mt-4 btn-primary">
              Proceed to Order
            </Button>
          </div>
        )}

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg">No products found matching your filters.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
