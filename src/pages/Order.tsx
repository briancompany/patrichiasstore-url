import { useEffect, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CartItem } from '@/types/product';
import { CreditCard, ShoppingBag, Store, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createUuid, isUuid } from '@/lib/uuid';
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from '@/lib/persist';

const getBackendErrorMessage = (err: unknown) => {
  const e = err as { message?: string; details?: string; hint?: string; code?: string } | null;
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');
  return 'Could not save your order. Please check your connection and try again.';
};

export default function Order() {
  const location = useLocation();
  const navigate = useNavigate();

  const navCart = (location.state as { cart?: CartItem[] } | null)?.cart;
  const [cartItems] = useState<CartItem[]>(() => navCart ?? storageGet<CartItem[]>(STORAGE_KEYS.shopCart) ?? []);

  useEffect(() => {
    if (navCart && navCart.length > 0) storageSet(STORAGE_KEYS.shopCart, navCart);
  }, [navCart]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    school: '',
    deliveryType: 'pickup' as 'pickup' | 'delivery',
    location: '',
    notes: '',
  });

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

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
      // Create the order (generate UUID client-side to avoid relying on returned rows)
      const orderId = createUuid();

      const { error: orderError } = await supabase
        .from('orders')
        // NOTE: Do not chain .select() here; returning the inserted row can fail under stricter RLS in production.
        .insert({
          id: orderId,
          customer_name: formData.fullName,
          customer_phone: formData.phone,
          customer_email: formData.email,
          customer_school: formData.school || null,
          delivery_type: formData.deliveryType,
          delivery_location: formData.deliveryType === 'delivery' ? formData.location : null,
          notes: formData.notes || null,
          total_amount: cartTotal,
          // Order must be saved first; payment comes after
          status: 'pending',
        });

      if (orderError) throw orderError;

      // Create order items - product_id must be UUID (fallback to null for non-UUID products)
      const orderItems = cartItems.map((item) => ({
        order_id: orderId,
        product_id: isUuid(item.product.id) ? item.product.id : null,
        product_name: item.product.name,
        school_name: item.product.school || null,
        size: item.selectedSize,
        quantity: item.quantity,
        price_at_purchase: item.price,
        printing_required: false,
        logo_url: null,
        color: null,
        sample_image_url: null,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      // Generate tracking code (best-effort)
      const trackingCode = generateTrackingCode();
      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        tracking_code: trackingCode,
      });

      if (trackingError) {
        console.warn('Tracking insert failed (continuing):', trackingError);
      }

      const paymentState = {
        orderId,
        trackingCode: trackingError ? null : trackingCode,
        total: cartTotal,
        customerName: formData.fullName,
        customerPhone: formData.phone,
        customerEmail: formData.email,
      };

      // Persist so refresh in published site doesn't lose the order/payment state
      storageSet(STORAGE_KEYS.pendingOrder, paymentState);
      storageRemove(STORAGE_KEYS.shopCart);

      // Navigate to payment page
      navigate('/payment', { state: paymentState });
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(getBackendErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFormValid =
    formData.fullName &&
    formData.email &&
    formData.phone &&
    (formData.deliveryType === 'pickup' || formData.location);

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Place Your Order</h1>
          <p className="text-muted-foreground mb-8">Fill in your details and proceed to payment</p>

          {cartItems.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No items in your order</h2>
              <p className="text-muted-foreground mb-6">Browse our shop and add items to your order first.</p>
              <Button asChild className="btn-primary">
                <Link to="/shop">Browse Shop</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Order Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5" />
                    Order Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.product.name} ({item.selectedSize}) x{item.quantity}
                      </span>
                      <span className="font-medium">Ksh {item.price.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t border-border mt-3 pt-3 flex justify-between">
                    <span className="font-semibold">Total:</span>
                    <span className="text-lg font-bold text-primary">Ksh {cartTotal.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Customer Details */}
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
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="you@example.com"
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
                    <Label htmlFor="school">School Name (Optional)</Label>
                    <Input
                      id="school"
                      name="school"
                      value={formData.school}
                      onChange={handleInputChange}
                      placeholder="Enter the school name"
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
                      <p className="font-medium text-foreground">Secure Payment</p>
                      <p className="text-sm text-muted-foreground">
                        After submitting, you'll choose between Pesapal STK Push or M-Pesa Paybill to complete payment.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit */}
              <Button
                type="submit"
                disabled={!isFormValid || isSubmitting}
                className="w-full h-12 text-lg"
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

              <p className="text-sm text-muted-foreground text-center">
                You'll be directed to our secure payment page to complete your order.
              </p>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
