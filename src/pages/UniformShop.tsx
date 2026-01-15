import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Search, ChevronRight, ChevronLeft, Check, Minus, Plus, ShoppingCart, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

interface ProductSize {
  size: string;
  price: number;
  stock?: number;
}

interface Product {
  id: string;
  name: string;
  type: string;
  description: string | null;
  image_url: string | null;
  sizes: ProductSize[];
  in_stock: boolean;
  school_id: string | null;
  schools?: { id: string; name: string; logo_url: string | null } | null;
}

interface School {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
  price: number;
  printingRequired: boolean;
  logoUrl: string | null;
}

type Step = 'search' | 'products' | 'printing' | 'review';

export default function UniformShop() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [schools, setSchools] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [printingRequired, setPrintingRequired] = useState<boolean | null>(null);

  // Fetch all schools on mount
  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const { data } = await supabase.from('schools').select('*').order('name');
    setSchools(data || []);
  };

  // Filter schools based on search
  const filteredSchools = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return schools.filter((school) =>
      school.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [schools, searchQuery]);

  // Fetch products when school is selected
  const fetchProductsForSchool = async (schoolId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, schools(id, name, logo_url)')
      .eq('school_id', schoolId)
      .eq('in_stock', true)
      .order('type');

    if (error) {
      toast.error('Error fetching products');
    } else {
      const mapped = (data || []).map((p) => ({
        ...p,
        sizes: (p.sizes as unknown as ProductSize[]) || [],
      }));
      setProducts(mapped);
    }
    setIsLoading(false);
  };

  const handleSchoolSelect = (school: School) => {
    setSelectedSchool(school);
    fetchProductsForSchool(school.id);
    setStep('products');
  };

  const handleAddToCart = () => {
    if (!currentProduct || !selectedSize) return;

    const existingIndex = cart.findIndex(
      (item) => item.product.id === currentProduct.id && item.selectedSize === selectedSize.size
    );

    const totalPrice = selectedSize.price * quantity;

    if (existingIndex >= 0) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += quantity;
      newCart[existingIndex].price += totalPrice;
      setCart(newCart);
    } else {
      setCart([
        ...cart,
        {
          product: currentProduct,
          selectedSize: selectedSize.size,
          quantity,
          price: totalPrice,
          printingRequired: false,
          logoUrl: null,
        },
      ]);
    }

    // Reset selection
    setCurrentProduct(null);
    setSelectedSize(null);
    setQuantity(1);
    toast.success('Added to cart!');
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const handleProceedToPrinting = () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart first');
      return;
    }
    setStep('printing');
    setPrintingRequired(null);
  };

  const handlePrintingConfirm = (needsPrinting: boolean) => {
    setPrintingRequired(needsPrinting);
    // Update all cart items with printing info
    const updatedCart = cart.map((item) => ({
      ...item,
      printingRequired: needsPrinting,
      logoUrl: needsPrinting ? selectedSchool?.logo_url || null : null,
    }));
    setCart(updatedCart);
  };

  const handleProceedToReview = () => {
    if (printingRequired === null) {
      toast.error('Please select a printing option');
      return;
    }
    setStep('review');
  };

  const handleProceedToCheckout = () => {
    navigate('/checkout', {
      state: {
        cart,
        school: selectedSchool,
        printingRequired,
      },
    });
  };

  const typeLabels: Record<string, string> = {
    tshirt: 'T-Shirt',
    tracksuit: 'Tracksuit',
    socks: 'Socks',
    shorts: 'Shorts',
    skirt: 'Skirt',
    sweater: 'Sweater',
    other: 'Other',
  };

  const getMinPrice = (sizes: ProductSize[]) => {
    if (!sizes || sizes.length === 0) return 0;
    return Math.min(...sizes.map((s) => s.price));
  };

  return (
    <Layout>
      <div className="container-shop py-8">
        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {['search', 'products', 'printing', 'review'].map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step === s
                    ? 'bg-primary text-primary-foreground'
                    : ['search', 'products', 'printing', 'review'].indexOf(step) > i
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {i + 1}
              </div>
              {i < 3 && <div className="w-8 h-0.5 bg-muted mx-1" />}
            </div>
          ))}
        </div>

        {/* Step 1: School Search */}
        {step === 'search' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <h1 className="text-3xl font-bold text-foreground mb-2">Find Your School Uniform</h1>
              <p className="text-muted-foreground">
                Enter your school name to find available uniforms
              </p>
            </div>

            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type your school name..."
                className="pl-12 h-14 text-lg"
                autoFocus
              />
            </div>

            {filteredSchools.length > 0 && (
              <Card>
                <CardContent className="p-2">
                  {filteredSchools.map((school) => (
                    <button
                      key={school.id}
                      onClick={() => handleSchoolSelect(school)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      {school.logo_url ? (
                        <img
                          src={school.logo_url}
                          alt={school.name}
                          className="w-12 h-12 rounded-full object-cover bg-muted"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-bold text-lg">
                            {school.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{school.name}</p>
                        <p className="text-sm text-muted-foreground">Click to view uniforms</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {searchQuery && filteredSchools.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground">
                    No schools found matching "{searchQuery}"
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Please check the spelling or contact us for assistance
                  </p>
                </CardContent>
              </Card>
            )}

            {cart.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <span className="font-medium">{cart.length} items in cart</span>
                  </div>
                  <Button onClick={() => setStep('review')}>View Cart</Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Step 2: Products Selection */}
        {step === 'products' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setStep('search')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {selectedSchool?.name} Uniforms
                </h1>
                <p className="text-muted-foreground">Select the uniforms you need</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : products.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No uniforms available for this school yet.
                  </p>
                  <Button variant="link" onClick={() => setStep('search')}>
                    Try another school
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Product Selection Modal */}
                {currentProduct && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                      <CardHeader className="flex flex-row items-start justify-between">
                        <div>
                          <CardTitle>{currentProduct.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {typeLabels[currentProduct.type]}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCurrentProduct(null);
                            setSelectedSize(null);
                            setQuantity(1);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {currentProduct.image_url && (
                          <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                            <img
                              src={currentProduct.image_url}
                              alt={currentProduct.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        <div>
                          <Label className="text-sm font-medium">Select Size</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {currentProduct.sizes.map((size) => (
                              <button
                                key={size.size}
                                onClick={() => setSelectedSize(size)}
                                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                                  selectedSize?.size === size.size
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                <span className="font-medium">{size.size}</span>
                                <span className="text-sm text-muted-foreground ml-2">
                                  Ksh {size.price.toLocaleString()}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Quantity</Label>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="font-semibold text-lg w-8 text-center">{quantity}</span>
                            <button
                              onClick={() => setQuantity(quantity + 1)}
                              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {selectedSize && (
                          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                            <span className="font-medium">Total:</span>
                            <span className="text-xl font-bold text-primary">
                              Ksh {(selectedSize.price * quantity).toLocaleString()}
                            </span>
                          </div>
                        )}

                        <Button
                          onClick={handleAddToCart}
                          disabled={!selectedSize}
                          className="w-full"
                          size="lg"
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Add to Cart
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Products Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map((product) => (
                    <Card
                      key={product.id}
                      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => setCurrentProduct(product)}
                    >
                      <div className="aspect-square bg-muted">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                            No Image
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <Badge className="mb-2">{typeLabels[product.type]}</Badge>
                        <h3 className="font-semibold">{product.name}</h3>
                        <p className="text-primary font-medium">
                          From Ksh {getMinPrice(product.sizes).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Cart Summary */}
                {cart.length > 0 && (
                  <Card className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 bg-card border-primary/20 shadow-lg z-40">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShoppingCart className="h-5 w-5 text-primary" />
                          <span className="font-semibold">{cart.length} items</span>
                        </div>
                        <span className="font-bold text-primary">
                          Ksh {cartTotal.toLocaleString()}
                        </span>
                      </div>
                      <Button onClick={handleProceedToPrinting} className="w-full">
                        Continue
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Printing Option */}
        {step === 'printing' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setStep('products')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Printing Option</h1>
                <p className="text-muted-foreground">
                  Would you like the school logo printed on your uniforms?
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="p-6 space-y-6">
                <RadioGroup
                  value={printingRequired === null ? '' : printingRequired ? 'yes' : 'no'}
                  onValueChange={(value) => handlePrintingConfirm(value === 'yes')}
                  className="space-y-4"
                >
                  <label
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      printingRequired === true
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="yes" className="mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold">Yes, add school logo</p>
                      <p className="text-sm text-muted-foreground">
                        We'll print your school's official logo on the uniforms
                      </p>
                    </div>
                    <Printer className="h-6 w-6 text-primary" />
                  </label>

                  <label
                    className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      printingRequired === false
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="no" className="mt-1" />
                    <div className="flex-1">
                      <p className="font-semibold">No printing needed</p>
                      <p className="text-sm text-muted-foreground">
                        Plain uniforms without any logos
                      </p>
                    </div>
                  </label>
                </RadioGroup>

                {/* Show school logo if printing is selected */}
                {printingRequired === true && selectedSchool?.logo_url && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-3">School Logo to be printed:</p>
                    <div className="flex items-center gap-4">
                      <img
                        src={selectedSchool.logo_url}
                        alt={selectedSchool.name}
                        className="w-20 h-20 rounded-lg object-cover bg-background"
                      />
                      <div>
                        <p className="font-semibold">{selectedSchool.name}</p>
                        <p className="text-sm text-muted-foreground">Official school logo</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="mt-4 w-full"
                      onClick={handleProceedToReview}
                    >
                      <Check className="h-4 w-4 mr-2" />
                      Confirm Logo & Continue
                    </Button>
                  </div>
                )}

                {printingRequired === true && !selectedSchool?.logo_url && (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      ⚠️ No logo uploaded for this school yet. Our team will contact you about the
                      logo after placing your order.
                    </p>
                  </div>
                )}

                {printingRequired === false && (
                  <Button onClick={handleProceedToReview} className="w-full" size="lg">
                    Continue to Review
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Order Review */}
        {step === 'review' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setStep('printing')}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Review Your Order</h1>
                <p className="text-muted-foreground">Confirm your items before checkout</p>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Items
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {item.product.image_url && (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-16 h-16 rounded-lg object-cover"
                        />
                      )}
                      <div>
                        <p className="font-semibold">{item.product.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Size: {item.selectedSize} × {item.quantity}
                        </p>
                        {item.printingRequired && (
                          <Badge variant="secondary" className="mt-1">
                            <Printer className="h-3 w-3 mr-1" />
                            With Logo
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">Ksh {item.price.toLocaleString()}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => removeFromCart(index)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      Ksh {cartTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {printingRequired && selectedSchool && (
              <Card>
                <CardContent className="p-4 flex items-center gap-4">
                  <Printer className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-semibold">Logo Printing Included</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedSchool.name} logo will be printed
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleProceedToCheckout} className="w-full" size="lg">
              Proceed to Checkout
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
