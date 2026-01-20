import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ShoppingBag, Printer, MapPin, Store, Loader2, CreditCard, Phone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CartItem {
  product: {
    id: string;
    name: string;
    image_url: string | null;
    type: string;
    schools?: { name: string } | null;
  };
  selectedSize: string;
  quantity: number;
  price: number;
  printingRequired: boolean;
  logoUrl: string | null;
  color?: string;
  sampleImageUrl?: string;
}

interface SelectedSchool {
  id?: string;
  name: string;
  logo_url?: string | null;
  isFromDB?: boolean;
}

interface LocationState {
  cart: CartItem[];
  school: SelectedSchool | null;
  printingRequired: boolean;
  isNewSchool?: boolean;
}

const WHATSAPP_NUMBER = '254726075180';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  
  const cart = state?.cart || [];
  const selectedSchool = state?.school;
  const printingRequired = state?.printingRequired || false;
  const isNewSchool = state?.isNewSchool || !selectedSchool?.isFromDB;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    deliveryType: 'pickup' as 'pickup' | 'delivery',
    location: '',
    notes: '',
  });

  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const generateTrackingCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'PS-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSubmitting(true);

    try {
      // Create the order with new school flag
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: formData.fullName,
          customer_phone: formData.phone,
          customer_school: selectedSchool?.name || null,
          delivery_type: formData.deliveryType,
          delivery_location: formData.deliveryType === 'delivery' ? formData.location : null,
          notes: formData.notes || null,
          total_amount: cartTotal,
          status: isNewSchool ? 'new_school_setup' : 'awaiting_payment',
          is_new_school: isNewSchool,
          linked_school_id: selectedSchool?.id || null,
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id.startsWith('custom-') ? null : item.product.id,
        product_name: item.product.name,
        school_name: selectedSchool?.name || null,
        size: item.selectedSize,
        quantity: item.quantity,
        price_at_purchase: item.price,
        printing_required: item.printingRequired,
        logo_url: item.logoUrl,
        color: item.color || null,
        sample_image_url: item.sampleImageUrl || null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      // Generate tracking code
      const trackingCode = generateTrackingCode();
      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderData.id,
        tracking_code: trackingCode,
      });

      // Navigate to payment page with order details
      navigate('/payment', {
        state: {
          orderId: orderData.id,
          trackingCode: trackingError ? null : trackingCode,
          total: cartTotal,
          customerName: formData.fullName,
          customerPhone: formData.phone,
          isNewSchool,
        },
      });
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error placing order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.fullName &&
    formData.phone &&
    (formData.deliveryType === 'pickup' || formData.location);

  if (cart.length === 0) {
    return (
      <Layout>
        <div className="container-shop py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No items in your order</h2>
            <p className="text-muted-foreground mb-6">
              Browse our shop and add items to your order first.
            </p>
            <Button asChild>
              <Link to="/uniform-shop">Browse Shop</Link>
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Checkout</h1>
              <p className="text-muted-foreground">Complete your order details</p>
            </div>
          </div>

          {/* New School Info Banner */}
          {isNewSchool && (
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">New School Order</p>
                  <p className="text-sm text-amber-700">
                    Your order for "{selectedSchool?.name}" will be tagged for admin review. 
                    We'll set up the school profile and contact you if we need the school logo.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Order Summary
                {isNewSchool && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 ml-2">
                    New School
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.product.name} ({item.selectedSize}) ×{item.quantity}
                    {item.printingRequired && (
                      <Badge variant="secondary" className="ml-2">
                        <Printer className="h-3 w-3 mr-1" />
                        Logo
                      </Badge>
                    )}
                  </span>
                  <span className="font-medium">Ksh {item.price.toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between">
                <span className="font-semibold">Total:</span>
                <span className="text-lg font-bold text-primary">
                  Ksh {cartTotal.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Customer Details Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g., 0712345678"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Special Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="Any special instructions for your order..."
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Delivery Options */}
            <Card>
              <CardHeader>
                <CardTitle>Delivery Method</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={formData.deliveryType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, deliveryType: value as 'pickup' | 'delivery' }))
                  }
                  className="space-y-3"
                >
                  <label
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      formData.deliveryType === 'pickup'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="pickup" />
                    <Store className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Pickup at Store</p>
                      <p className="text-sm text-muted-foreground">Store F47, Uhuru Market</p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      formData.deliveryType === 'delivery'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="delivery" />
                    <MapPin className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Delivery</p>
                      <p className="text-sm text-muted-foreground">We'll deliver to your location</p>
                    </div>
                  </label>
                </RadioGroup>

                {formData.deliveryType === 'delivery' && (
                  <div>
                    <Label htmlFor="location">Delivery Location *</Label>
                    <Textarea
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Enter your delivery address (area, landmark, building)"
                      required
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Info */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <CreditCard className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">M-Pesa Payment</p>
                    <p className="text-sm text-muted-foreground">
                      After submitting, you'll be directed to pay via M-Pesa Paybill. 
                      Paste your confirmation SMS to instantly verify payment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className="w-full"
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>

            {/* Help */}
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                className="text-muted-foreground"
                onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello! I need help with my order.')}`, '_blank')}
              >
                <Phone className="h-4 w-4 mr-1" />
                Need help? Contact us on WhatsApp
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
