import { useState, useMemo, useEffect } from 'react';
import { FlashSaleBanner } from '@/components/FlashSaleBanner';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { slugify } from '@/lib/slug';
import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ProductCard';
import { Product, CartItem } from '@/types/product';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from '@/lib/persist';
import { useGeneralProducts, useSchoolsList } from '@/hooks/useProductCache';
import { ProductGridSkeleton } from '@/components/ProductSkeleton';
import { ShoppingCart, X, Search, ChevronRight, Package, Clock } from 'lucide-react';
import { ShopPriceChart } from '@/components/ShopPriceChart';

export default function Shop() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string>(searchParams.get('type') || 'all');
  const [cart, setCart] = useState<CartItem[]>(() => storageGet<CartItem[]>(STORAGE_KEYS.shopCart) ?? []);
  const [showCart, setShowCart] = useState(false);
  const [schoolSearch, setSchoolSearch] = useState('');
  const [showSchoolSearch, setShowSchoolSearch] = useState(false);

  // Shared cached hooks — no duplicate API calls
  const dbSchools = useSchoolsList();
  const { products: rawGeneralProducts, loaded: generalLoaded } = useGeneralProducts();

  // Map DB products to the Product type used by ProductCard
  const generalProducts: Product[] = useMemo(() => {
    return rawGeneralProducts.map((p) => ({
      id: p.id,
      name: p.name,
      school: 'General',
      type: p.type as Product['type'],
      image: p.image_url || '/placeholder.svg',
      sizes: p.sizes,
      inStock: p.in_stock,
      description: p.description || undefined,
    }));
  }, [rawGeneralProducts]);

  // Filter database schools based on search (client-side only)
  const filteredDbSchools = useMemo(() => {
    if (!schoolSearch.trim()) return [];
    return dbSchools.filter((school) =>
      school.name.toLowerCase().includes(schoolSearch.toLowerCase())
    );
  }, [dbSchools, schoolSearch]);

  const filteredProducts = useMemo(() => {
    return generalProducts.filter((product) => {
      const typeMatch = selectedType === 'all' || product.type === selectedType;
      return typeMatch;
    });
  }, [generalProducts, selectedType]);

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

  useEffect(() => {
    if (cart.length > 0) storageSet(STORAGE_KEYS.shopCart, cart);
    else storageRemove(STORAGE_KEYS.shopCart);
  }, [cart]);

  const handleProceedToCheckout = () => {
    storageSet(STORAGE_KEYS.shopCart, cart);
    navigate('/order', { state: { cart } });
  };

  const handleGoToUniformShop = () => {
    navigate('/uniform-shop');
    setShowSchoolSearch(false);
    setSchoolSearch('');
  };

  const typeLabels: Record<string, string> = {
    all: 'All Types',
    tshirt: 'T-Shirts',
    shirts: 'Shirts',
    tracksuit: 'Tracksuits',
    socks: 'Socks',
    shorts: 'Shorts',
    trousers: 'Trousers',
    skirt: 'Skirts',
    sweater: 'Sweaters',
    tie: 'Ties',
    dress: 'Dresses',
    fleece_jacket: 'Fleece Jackets',
    other: 'Other',
  };

  const uniformTypes = ['tshirt', 'shirts', 'tracksuit', 'socks', 'shorts', 'trousers', 'skirt', 'sweater', 'tie', 'dress', 'fleece_jacket'];

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Shop Uniforms</h1>
          <p className="text-muted-foreground">Browse our collection and add items to your order</p>
        </div>

        {/* Flash Sales */}
        <div className="mb-6">
          <FlashSaleBanner />
        </div>

        {/* Search for School CTA */}
        <Card className="mb-6 bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <p className="font-semibold text-foreground">Looking for your school's uniforms?</p>
                <p className="text-sm text-muted-foreground">
                  Search by school name to find all available uniforms with logo printing option
                </p>
              </div>
              <Button onClick={() => setShowSchoolSearch(!showSchoolSearch)} className="gap-2">
                <Search className="h-4 w-4" />
                Search School
              </Button>
            </div>

            {showSchoolSearch && (
              <div className="mt-4 space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={schoolSearch}
                    onChange={(e) => setSchoolSearch(e.target.value)}
                    placeholder="Type your school name..."
                    className="pl-10"
                    autoFocus
                  />
                </div>

                {filteredDbSchools.length > 0 && (
                  <div className="bg-background rounded-lg border divide-y">
                    {filteredDbSchools.map((school) => (
                      <div key={school.id} className="relative">
                        <button
                          onClick={() => handleGoToUniformShop()}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
                        >
                          {school.logo_url ? (
                            <img
                              src={school.logo_url}
                              alt={school.name}
                              className="w-10 h-10 rounded-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <span className="text-primary font-bold">
                                {school.name.charAt(0)}
                              </span>
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{school.name}</p>
                            <p className="text-xs text-muted-foreground">Tap to view uniforms</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                        <Link
                          to={`/uniform-shop/school/${slugify(school.name)}`}
                          className="sr-only"
                          tabIndex={-1}
                          aria-hidden="true"
                        >
                          {school.name} uniform
                        </Link>
                      </div>
                    ))}
                  </div>
                )}

                {schoolSearch && filteredDbSchools.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No schools found. Try a different search or{' '}
                    <button
                      onClick={() => handleGoToUniformShop()}
                      className="text-primary underline"
                    >
                      browse all products
                    </button>
                  </p>
                )}

                <Button onClick={() => handleGoToUniformShop()} variant="outline" className="w-full">
                  Go to Advanced Uniform Shop
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
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
                      Size: {item.selectedSize} • Qty: {item.quantity}
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
            <Button onClick={handleProceedToCheckout} className="w-full mt-4 btn-primary">
              Proceed to Payment
            </Button>
          </div>
        )}

        {/* Price Chart & Description */}
        <ShopPriceChart />

        {/* Products Loading */}
        {!generalLoaded && (
          <ProductGridSkeleton count={8} />
        )}

        {/* Products Coming Soon */}
        {generalLoaded && filteredProducts.length === 0 && (
          <Card className="border-dashed border-2 border-primary/30">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Clock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Products Coming Soon!</h3>
              <p className="text-muted-foreground max-w-md mb-4">
                We're updating our collection with fresh uniforms. Check back soon or search for your school's specific uniforms.
              </p>
              <Button onClick={() => handleGoToUniformShop()} className="gap-2">
                <Search className="h-4 w-4" />
                Search by School
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Products Grid */}
        {filteredProducts.length > 0 && (
          <div>
            <div className="flex items-center gap-3 mb-6">
              <Package className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Our Products</h2>
              <span className="bg-primary/10 text-primary text-sm px-3 py-1 rounded-full font-medium">
                {filteredProducts.length} items
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
