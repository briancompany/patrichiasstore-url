import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { Search, ChevronRight, ChevronLeft, Check, Minus, Plus, ShoppingCart, Printer, X, Database, Loader2, AlertTriangle, School, Package, Palette, Upload, Image, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import { searchSchools, type SchoolResult } from '@/lib/api/schoolSearch';
import { SchoolLogoViewer } from '@/components/SchoolLogoViewer';
import { showCartConfirmation } from '@/components/CartConfirmationToast';
import { useGeneralProducts, usePricingChart } from '@/hooks/useProductCache';

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

interface SelectedSchool {
  id?: string;
  name: string;
  logo_url: string | null;
  isFromDB: boolean;
}

interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
  price: number;
  printingRequired: boolean;
  logoUrl: string | null;
  color?: string;
  sampleImageUrl?: string;
}

type Step = 'search' | 'products' | 'printing' | 'review';

export default function UniformShop() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SchoolResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<SelectedSchool | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [printingRequired, setPrintingRequired] = useState<boolean | null>(null);
  const [showCustomOrderFlow, setShowCustomOrderFlow] = useState(false);
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [sampleImage, setSampleImage] = useState<File | null>(null);
  const [uploadingSample, setUploadingSample] = useState(false);

  // Use shared cached hooks — no duplicate API calls
  const pricingChart = usePricingChart();
  const { products: cachedGeneralProducts } = useGeneralProducts();
  const generalProducts = cachedGeneralProducts.map((p) => ({
    ...p,
    sizes: p.sizes as ProductSize[],
  }));

  // Fetch pricing chart and general products on mount
  useEffect(() => {
    const fetchPricingChart = async () => {
      const { data, error } = await supabase
        .from('pricing_chart')
        .select('*')
        .order('uniform_type')
        .order('size');

      if (!error && data) {
        const grouped: Record<string, ProductSize[]> = {};
        data.forEach((item: { uniform_type: string; size: string; price: number }) => {
          if (!grouped[item.uniform_type]) {
            grouped[item.uniform_type] = [];
          }
          grouped[item.uniform_type].push({ size: item.size, price: item.price });
        });
        setPricingChart(grouped);
      }
    };

    const fetchGeneralProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .is('school_id', null)
        .eq('in_stock', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const mapped = data.map((p) => ({
          ...p,
          sizes: (p.sizes as unknown as ProductSize[]) || [],
        }));
        setGeneralProducts(mapped);
      }
    };

    fetchPricingChart();
    fetchGeneralProducts();
  }, []);

  // Debounced search
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSearchResults([]);
      setShowCustomOrderFlow(false);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchSchools(query);
      setSearchResults(results);
      // Show custom order flow if no results found
      setShowCustomOrderFlow(results.length === 0);
      if (results.length === 0) {
        setCustomSchoolName(query);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Error searching for schools');
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce the search
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // Fetch products when school is selected from DB
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

  // Create standard products for unregistered schools
  const createStandardProducts = (schoolName: string): Product[] => {
    const uniformTypes = ['tshirt', 'tracksuit', 'socks', 'shorts', 'sweater'];

    const defaultPrices: Record<string, { name: string; prices: ProductSize[] }> = {
      tshirt: { name: 'T-Shirt', prices: [{ size: 'S', price: 800 }, { size: 'M', price: 850 }, { size: 'L', price: 900 }, { size: 'XL', price: 950 }] },
      tracksuit: { name: 'Tracksuit', prices: [{ size: 'S', price: 2500 }, { size: 'M', price: 2600 }, { size: 'L', price: 2700 }, { size: 'XL', price: 2800 }] },
      socks: { name: 'Socks', prices: [{ size: 'One Size', price: 350 }] },
      shorts: { name: 'Shorts', prices: [{ size: 'S', price: 600 }, { size: 'M', price: 650 }, { size: 'L', price: 700 }] },
      sweater: { name: 'Sweater', prices: [{ size: 'S', price: 1500 }, { size: 'M', price: 1600 }, { size: 'L', price: 1700 }] },
    };

    const typeNames: Record<string, string> = {
      tshirt: 'T-Shirt',
      tracksuit: 'Tracksuit',
      socks: 'Socks',
      shorts: 'Shorts',
      sweater: 'Sweater',
    };

    return uniformTypes.map((type, index) => {
      const prices = pricingChart[type] && pricingChart[type].length > 0
        ? pricingChart[type]
        : defaultPrices[type]?.prices || [{ size: 'M', price: 1000 }];

      return {
        id: `custom-${type}-${index}`,
        name: `${schoolName} ${typeNames[type]}`,
        type,
        description: `Standard ${typeNames[type]} for ${schoolName}`,
        image_url: null,
        sizes: prices,
        in_stock: true,
        school_id: null,
      };
    });
  };

  const handleSchoolSelect = (school: SchoolResult) => {
    // DB school - fetch actual products
    setSelectedSchool({
      id: school.id,
      name: school.name,
      logo_url: school.logo_url,
      isFromDB: true,
    });
    fetchProductsForSchool(school.id);
    setStep('products');
  };

  const handleCustomSchoolContinue = () => {
    if (!customSchoolName.trim()) {
      toast.error('Please enter a school name');
      return;
    }
    // Set up for unregistered school
    setSelectedSchool({
      name: customSchoolName.trim(),
      logo_url: null,
      isFromDB: false,
    });
    setProducts(createStandardProducts(customSchoolName.trim()));
    setStep('products');
  };

  const handleUploadSampleImage = async (file: File): Promise<string | null> => {
    try {
      setUploadingSample(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `sample-${Date.now()}.${fileExt}`;
      const filePath = `samples/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      return publicUrl.publicUrl;
    } catch (error) {
      console.error('Error uploading sample:', error);
      toast.error('Failed to upload sample image');
      return null;
    } finally {
      setUploadingSample(false);
    }
  };

  const handleAddToCart = async () => {
    if (!currentProduct || !selectedSize) return;

    let sampleImageUrl: string | null = null;
    if (sampleImage) {
      sampleImageUrl = await handleUploadSampleImage(sampleImage);
    }

    const existingIndex = cart.findIndex(
      (item) => item.product.id === currentProduct.id && 
                item.selectedSize === selectedSize.size &&
                item.color === selectedColor
    );

    const totalPrice = selectedSize.price * quantity;
    let newCartCount = cart.length;

    if (existingIndex >= 0 && !sampleImageUrl) {
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
          color: selectedColor || undefined,
          sampleImageUrl: sampleImageUrl || undefined,
        },
      ]);
      newCartCount = cart.length + 1;
    }

    // Show enhanced cart confirmation
    showCartConfirmation({
      productName: currentProduct.name,
      quantity,
      totalPrice,
      cartCount: newCartCount,
    });

    setCurrentProduct(null);
    setSelectedSize(null);
    setQuantity(1);
    setSelectedColor('');
    setSampleImage(null);
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

  // Items that should NOT have logo printed (e.g., shorts, skirts, dresses, trousers)
  const noLogoTypes = ['shorts', 'skirt', 'dress', 'trousers'];
  
  const handlePrintingConfirm = (needsPrinting: boolean) => {
    setPrintingRequired(needsPrinting);
    // Auto-apply logo to eligible items only
    const updatedCart = cart.map((item) => {
      const canHaveLogo = !noLogoTypes.includes(item.product.type);
      return {
        ...item,
        printingRequired: needsPrinting && canHaveLogo,
        logoUrl: needsPrinting && canHaveLogo ? selectedSchool?.logo_url || null : null,
      };
    });
    setCart(updatedCart);
  };

  const toggleItemPrinting = (index: number) => {
    const item = cart[index];
    const canHaveLogo = !noLogoTypes.includes(item.product.type);
    if (!canHaveLogo) {
      toast.error(`${item.product.name} cannot have logo printed`);
      return;
    }
    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      printingRequired: !newCart[index].printingRequired,
      logoUrl: !newCart[index].printingRequired ? selectedSchool?.logo_url || null : null,
    };
    setCart(newCart);
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
        isNewSchool: !selectedSchool?.isFromDB,
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

            {isSearching && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Searching schools...</span>
              </div>
            )}

            {/* Registered Schools Results */}
            {!isSearching && searchResults.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Registered Schools
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
                  {searchResults.map((school) => (
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
                          <School className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{school.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Click to view uniforms
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Custom Order Flow for Unregistered Schools */}
            {!isSearching && showCustomOrderFlow && searchQuery.length >= 3 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">
                          School Not Yet Registered
                        </h3>
                        <p className="text-muted-foreground mt-1">
                          "{customSchoolName}" is not in our system yet, but you can still order uniforms!
                        </p>
                      </div>

                      <div className="bg-white rounded-lg p-4 space-y-3">
                        <p className="text-sm font-medium text-foreground">
                          ✓ Select from standard uniform options
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          ✓ Choose your sizes and quantities
                        </p>
                        <p className="text-sm font-medium text-foreground">
                          ✓ Request logo printing (we'll contact you for the logo)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="schoolName" className="text-sm font-medium">
                          Confirm school name
                        </Label>
                        <Input
                          id="schoolName"
                          value={customSchoolName}
                          onChange={(e) => setCustomSchoolName(e.target.value)}
                          placeholder="Enter exact school name"
                          className="bg-white"
                        />
                      </div>

                      <Button 
                        onClick={handleCustomSchoolContinue}
                        className="w-full"
                        size="lg"
                      >
                        Continue with Custom Order
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {cart.length > 0 && (
              <Card className="bg-accent/10 border-accent border-2 shadow-lg">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                      <ShoppingCart className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <span className="font-bold text-lg">{cart.length} items in cart</span>
                      <p className="text-sm text-muted-foreground">
                        Ksh {cartTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setStep('review')} 
                    className="bg-accent hover:bg-accent/90 text-accent-foreground font-bold h-12 px-6"
                  >
                    View Cart
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* General Products Available to All */}
            {generalProducts.length > 0 && searchQuery.length < 3 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">General Products</h2>
                </div>
                <p className="text-muted-foreground mb-4">
                  These products are available to all customers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generalProducts.map((product) => (
                    <Card
                      key={product.id}
                      className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                      onClick={() => {
                        setCurrentProduct(product);
                        setSelectedSchool(null);
                      }}
                    >
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5">
                            <Package className="h-12 w-12 text-primary/40" />
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold truncate">{product.name}</h3>
                        <div className="flex items-center justify-between mt-2">
                          <Badge variant="secondary">{typeLabels[product.type]}</Badge>
                          <span className="text-sm font-medium text-primary">
                            From Ksh {getMinPrice(product.sizes).toLocaleString()}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Product Selection Modal for General Products */}
            {currentProduct && !selectedSchool && (
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
                    {currentProduct.image_url ? (
                      <div className="aspect-video rounded-lg overflow-hidden bg-muted">
                        <img
                          src={currentProduct.image_url}
                          alt={currentProduct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex flex-col items-center justify-center">
                        <Package className="h-12 w-12 text-primary/40" />
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
                      onClick={() => {
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
                        setCurrentProduct(null);
                        setSelectedSize(null);
                        setQuantity(1);
                        toast.success('Added to cart!');
                      }}
                      disabled={!selectedSize}
                      className="w-full h-14 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground"
                      size="lg"
                    >
                      <ShoppingCart className="h-5 w-5 mr-2" />
                      Add to Cart - Ksh {selectedSize ? (selectedSize.price * quantity).toLocaleString() : '0'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
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
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {selectedSchool?.name} Uniforms
                  </h1>
                  {!selectedSchool?.isFromDB && (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                      Custom Order
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">Select the uniforms you need</p>
              </div>
            </div>

            {/* Info banner for unregistered schools */}
            {!selectedSchool?.isFromDB && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800">
                    This school is not yet in our system. Your order will be marked for setup, and our team will add the school profile.
                  </p>
                </CardContent>
              </Card>
            )}

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
                {/* Product Selection Modal - Redesigned with fixed bottom action bar */}
                {currentProduct && (
                  <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center">
                    <Card className="w-full max-w-md md:m-4 rounded-t-2xl md:rounded-2xl max-h-[90vh] md:max-h-[85vh] flex flex-col">
                      {/* Header */}
                      <CardHeader className="flex flex-row items-start justify-between pb-2 shrink-0">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{currentProduct.name}</CardTitle>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary">{typeLabels[currentProduct.type]}</Badge>
                            {selectedSchool?.logo_url && selectedSchool.isFromDB && (
                              <SchoolLogoViewer 
                                logoUrl={selectedSchool.logo_url} 
                                schoolName={selectedSchool.name}
                                trigger={
                                  <button className="flex items-center gap-1 text-xs text-primary hover:underline">
                                    <ZoomIn className="h-3 w-3" />
                                    View Logo
                                  </button>
                                }
                              />
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            setCurrentProduct(null);
                            setSelectedSize(null);
                            setQuantity(1);
                            setSelectedColor('');
                            setSampleImage(null);
                          }}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </CardHeader>
                      
                      {/* Scrollable Content */}
                      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-4">
                        {/* Product Image - Compact */}
                        {currentProduct.image_url ? (
                          <div className="aspect-[16/10] rounded-lg overflow-hidden bg-muted">
                            <img
                              src={currentProduct.image_url}
                              alt={currentProduct.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="aspect-[16/10] rounded-lg overflow-hidden bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center gap-4">
                            <div className="text-4xl">
                              {currentProduct.type === 'tshirt' && '👕'}
                              {currentProduct.type === 'tracksuit' && '🥋'}
                              {currentProduct.type === 'socks' && '🧦'}
                              {currentProduct.type === 'shorts' && '🩳'}
                              {currentProduct.type === 'skirt' && '👗'}
                              {currentProduct.type === 'sweater' && '🧥'}
                              {currentProduct.type === 'other' && '👔'}
                            </div>
                            {selectedSchool?.logo_url && (
                              <img 
                                src={selectedSchool.logo_url} 
                                alt="School logo" 
                                className="w-14 h-14 rounded-full border-2 border-primary/20 object-cover"
                              />
                            )}
                          </div>
                        )}

                        {/* Size Selection */}
                        <div>
                          <Label className="text-sm font-medium">Size *</Label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {currentProduct.sizes.map((size) => (
                              <button
                                key={size.size}
                                onClick={() => setSelectedSize(size)}
                                className={`px-3 py-1.5 rounded-lg border-2 transition-colors text-sm ${
                                  selectedSize?.size === size.size
                                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {size.size} <span className="text-xs opacity-70">Ksh {size.price.toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center justify-between py-1">
                          <Label className="text-sm font-medium">Quantity</Label>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="font-semibold text-lg w-8 text-center">{quantity}</span>
                            <button
                              onClick={() => setQuantity(quantity + 1)}
                              className="w-9 h-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Color Selection - Compact */}
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Palette className="h-3.5 w-3.5" />
                            Color (Optional)
                          </Label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {['White', 'Black', 'Navy', 'Red', 'Green', 'Yellow', 'Grey', 'Maroon', 'Blue'].map((color) => (
                              <button
                                key={color}
                                onClick={() => setSelectedColor(selectedColor === color ? '' : color)}
                                className={`px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                                  selectedColor === color
                                    ? 'border-primary bg-primary/10 text-primary font-medium'
                                    : 'border-border hover:border-primary/50'
                                }`}
                              >
                                {color}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Sample Image Upload - Compact */}
                        <div>
                          <Label className="text-sm font-medium flex items-center gap-1">
                            <Image className="h-3.5 w-3.5" />
                            Sample Image (Optional)
                          </Label>
                          <div className="flex items-center gap-2 mt-1.5">
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => setSampleImage(e.target.files?.[0] || null)}
                              className="flex-1 text-sm h-9"
                            />
                            {sampleImage && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-9 w-9"
                                onClick={() => setSampleImage(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                          {sampleImage && (
                            <p className="text-xs text-muted-foreground mt-1">
                              📎 {sampleImage.name}
                            </p>
                          )}
                        </div>
                      </CardContent>
                      
                      {/* Fixed Bottom Action Bar */}
                      <div className="border-t bg-card p-4 shrink-0 safe-area-bottom">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm text-muted-foreground">Total Price:</span>
                          <span className="text-2xl font-bold text-primary">
                            Ksh {selectedSize ? (selectedSize.price * quantity).toLocaleString() : '0'}
                          </span>
                        </div>
                        <Button
                          onClick={handleAddToCart}
                          disabled={!selectedSize || uploadingSample}
                          className="w-full h-14 text-lg font-bold bg-accent hover:bg-accent/90 text-accent-foreground shadow-lg"
                          size="lg"
                        >
                          {uploadingSample ? (
                            <>
                              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="h-5 w-5 mr-2" />
                              Add to Cart
                            </>
                          )}
                        </Button>
                      </div>
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
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/10 to-primary/5 text-primary p-4">
                            <div className="text-4xl mb-2">
                              {product.type === 'tshirt' && '👕'}
                              {product.type === 'tracksuit' && '🥋'}
                              {product.type === 'socks' && '🧦'}
                              {product.type === 'shorts' && '🩳'}
                              {product.type === 'skirt' && '👗'}
                              {product.type === 'sweater' && '🧥'}
                              {product.type === 'other' && '👔'}
                            </div>
                            <span className="text-sm font-medium text-center">
                              {typeLabels[product.type]}
                            </span>
                            {selectedSchool?.logo_url && (
                              <img 
                                src={selectedSchool.logo_url} 
                                alt="School logo" 
                                className="w-12 h-12 rounded-full mt-2 border-2 border-primary/20 object-cover"
                              />
                            )}
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

                {/* Cart Summary - Fixed at bottom for easy access */}
                {cart.length > 0 && (
                  <Card className="fixed bottom-0 left-0 right-0 md:bottom-4 md:left-auto md:right-8 md:w-96 md:rounded-lg rounded-none bg-card border-t-2 md:border-2 border-accent shadow-2xl z-50">
                    <CardContent className="p-4 safe-area-bottom">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                            <ShoppingCart className="h-5 w-5 text-accent-foreground" />
                          </div>
                          <div>
                            <span className="font-bold text-lg">{cart.length} items</span>
                            <p className="text-sm text-muted-foreground">in your cart</p>
                          </div>
                        </div>
                        <span className="font-bold text-xl text-accent">
                          Ksh {cartTotal.toLocaleString()}
                        </span>
                      </div>
                      <Button onClick={handleProceedToPrinting} className="w-full h-12 text-lg bg-accent hover:bg-accent/90 text-accent-foreground font-bold">
                        <ShoppingCart className="h-5 w-5 mr-2" />
                        Continue to Checkout
                        <ChevronRight className="h-5 w-5 ml-2" />
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

                {/* Per-item logo selection when printing is enabled */}
                {printingRequired === true && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium">Select items for logo printing:</p>
                    <div className="space-y-2">
                      {cart.map((item, index) => {
                        const canHaveLogo = !noLogoTypes.includes(item.product.type);
                        return (
                          <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${item.printingRequired ? 'bg-primary/5 border-primary' : 'bg-muted'}`}>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{item.product.name}</p>
                              <p className="text-xs text-muted-foreground">Size: {item.selectedSize} × {item.quantity}</p>
                            </div>
                            {canHaveLogo ? (
                              <Button
                                variant={item.printingRequired ? "default" : "outline"}
                                size="sm"
                                onClick={() => toggleItemPrinting(index)}
                              >
                                {item.printingRequired ? <><Check className="h-3 w-3 mr-1" /> Logo</> : 'Add Logo'}
                              </Button>
                            ) : (
                              <Badge variant="secondary" className="text-xs">No Logo</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {selectedSchool?.logo_url ? (
                      <div className="p-3 bg-muted rounded-lg flex items-center gap-3">
                        <img src={selectedSchool.logo_url} alt="Logo" className="w-12 h-12 rounded object-cover" />
                        <p className="text-sm">{selectedSchool.name} logo</p>
                      </div>
                    ) : (
                      <p className="text-sm text-amber-600">⚠️ Logo will be collected after order</p>
                    )}
                    
                    <Button onClick={handleProceedToReview} className="w-full" size="lg">
                      Continue to Review
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
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

            {/* New school info banner */}
            {!selectedSchool?.isFromDB && (
              <Card className="bg-amber-50 border-amber-200">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-800">New School Order</p>
                    <p className="text-sm text-amber-700">
                      This order will be tagged for school profile setup.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

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
                        {item.color && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Palette className="h-3 w-3" />
                            Color: {item.color}
                          </p>
                        )}
                        {item.sampleImageUrl && (
                          <Badge variant="outline" className="mt-1 text-xs">
                            <Upload className="h-3 w-3 mr-1" />
                            Sample Attached
                          </Badge>
                        )}
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
                    <p className="font-semibold">Logo Printing Requested</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedSchool.logo_url 
                        ? `${selectedSchool.name} logo will be printed`
                        : `Logo to be collected for ${selectedSchool.name}`
                      }
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
