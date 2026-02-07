import { useState } from 'react';
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

export default function Order() {
  const location = useLocation();
  const navigate = useNavigate();
  const cartItems: CartItem[] = location.state?.cart || [];
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
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

  const createClientOrderId = () => {
    const cryptoObj = (globalThis as unknown as { crypto?: Crypto }).crypto;

    try {
      if (cryptoObj?.randomUUID) {
        return cryptoObj.randomUUID();
      }

      if (cryptoObj?.getRandomValues) {
        const bytes = new Uint8Array(16);
        cryptoObj.getRandomValues(bytes);

        // RFC 4122 version 4
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;

        const toHex = (n: number) => n.toString(16).padStart(2, '0');
        const hex = Array.from(bytes, toHex).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
    } catch {
      // ignore and fallback
    }

    return `order-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create the order (generate id client-side to avoid RLS SELECT returning issues)
      const orderId = createClientOrderId();

      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          id: orderId,
          customer_name: formData.fullName,
          customer_phone: formData.phone,
          customer_school: formData.school || null,
          delivery_type: formData.deliveryType,
          delivery_location: formData.deliveryType === 'delivery' ? formData.location : null,
          notes: formData.notes || null,
          total_amount: cartTotal,
          status: 'awaiting_payment',
        });

      if (orderError) throw orderError;

      if (orderError) throw orderError;

      // Create order items - handle custom product IDs
      const orderItems = cartItems.map((item) => ({
        order_id: orderId,
        product_id: item.product.id.startsWith('custom-') ? null : item.product.id,
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

      // Generate tracking code
      const trackingCode = generateTrackingCode();
      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        tracking_code: trackingCode,
      });

      // Navigate to payment page
      navigate('/payment', {
        state: {
          orderId,
          trackingCode: trackingError ? null : trackingCode,
          total: cartTotal,
          customerName: formData.fullName,
          customerPhone: formData.phone,
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
