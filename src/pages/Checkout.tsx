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
import { ChevronLeft, ShoppingBag, Printer, MapPin, Store, ChevronRight, Loader2, MessageCircle, CreditCard } from 'lucide-react';
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
}

interface SelectedSchool {
  id?: string;
  name: string;
  logo_url?: string | null;
  isFromWeb?: boolean;
}

interface LocationState {
  cart: CartItem[];
  school: SelectedSchool | null;
  printingRequired: boolean;
}

type OrderMethod = 'whatsapp' | 'mpesa';

const WHATSAPP_NUMBER = '254726075180';

export default function Checkout() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;
  
  const cart = state?.cart || [];
  const selectedSchool = state?.school;
  const printingRequired = state?.printingRequired || false;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderMethod, setOrderMethod] = useState<OrderMethod | null>(null);
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

  const generateOrderMessage = () => {
    let message = `🛒 *New Order from Patrichia's Store*\n\n`;
    message += `👤 *Customer:* ${formData.fullName}\n`;
    message += `📱 *Phone:* ${formData.phone}\n`;
    message += `🏫 *School:* ${selectedSchool?.name || 'N/A'}\n`;
    message += `📍 *Delivery:* ${formData.deliveryType === 'pickup' ? 'Pickup at Store F47, Uhuru Market' : formData.location}\n\n`;
    
    message += `📦 *Order Items:*\n`;
    cart.forEach((item, index) => {
      message += `${index + 1}. ${item.product.name} - Size ${item.selectedSize} × ${item.quantity} = Ksh ${item.price.toLocaleString()}`;
      if (item.printingRequired) message += ` (+ Logo)`;
      message += `\n`;
    });
    
    message += `\n💰 *Total: Ksh ${cartTotal.toLocaleString()}*`;
    
    if (formData.notes) {
      message += `\n\n📝 *Notes:* ${formData.notes}`;
    }
    
    return encodeURIComponent(message);
  };

  const handleWhatsAppOrder = () => {
    const message = generateOrderMessage();
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
    toast.success('Opening WhatsApp to complete your order!');
  };

  const saveWebSchool = async (): Promise<string | null> => {
    // If school is from web and hasn't been saved yet, save it to DB
    if (selectedSchool?.isFromWeb && selectedSchool.name) {
      try {
        // Check if school already exists
        const { data: existing } = await supabase
          .from('schools')
          .select('id')
          .eq('name', selectedSchool.name)
          .maybeSingle();

        if (existing) {
          return existing.id;
        }

        // Save new school
        const { data: newSchool, error } = await supabase
          .from('schools')
          .insert({
            name: selectedSchool.name,
            logo_url: selectedSchool.logo_url || null,
          })
          .select()
          .single();

        if (!error && newSchool) {
          return newSchool.id;
        }
      } catch (error) {
        console.log('Could not save school:', error);
      }
    }
    return selectedSchool?.id || null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (orderMethod === 'whatsapp') {
      handleWhatsAppOrder();
      return;
    }

    // M-Pesa flow - create order in database
    setIsSubmitting(true);

    try {
      // Save web school if applicable (for future searches)
      await saveWebSchool();

      // Create the order
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
          status: 'awaiting_payment',
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cart.map((item) => ({
        order_id: orderData.id,
        product_id: item.product.id.startsWith('web-') ? null : item.product.id,
        product_name: item.product.name,
        school_name: selectedSchool?.name || null,
        size: item.selectedSize,
        quantity: item.quantity,
        price_at_purchase: item.price,
        printing_required: item.printingRequired,
        logo_url: item.logoUrl,
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
    orderMethod &&
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

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5" />
                Order Summary
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

            {/* Order Method Selection */}
            <Card>
              <CardHeader>
                <CardTitle>How would you like to order?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup
                  value={orderMethod || ''}
                  onValueChange={(value) => setOrderMethod(value as OrderMethod)}
                  className="space-y-3"
                >
                  <label
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      orderMethod === 'whatsapp'
                        ? 'border-green-500 bg-green-50'
                        : 'border-border hover:border-green-500/50'
                    }`}
                  >
                    <RadioGroupItem value="whatsapp" />
                    <MessageCircle className="h-6 w-6 text-green-600" />
                    <div className="flex-1">
                      <p className="font-medium">Order via WhatsApp</p>
                      <p className="text-sm text-muted-foreground">
                        Send order directly to our WhatsApp and pay on delivery
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      orderMethod === 'mpesa'
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <RadioGroupItem value="mpesa" />
                    <CreditCard className="h-6 w-6 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Pay with M-Pesa</p>
                      <p className="text-sm text-muted-foreground">
                        Pay via Paybill and get order confirmation
                      </p>
                    </div>
                  </label>
                </RadioGroup>
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

            {/* Submit */}
            <Button
              type="submit"
              disabled={!isFormValid || isSubmitting}
              className={`w-full ${orderMethod === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}`}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Placing Order...
                </>
              ) : orderMethod === 'whatsapp' ? (
                <>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Send Order via WhatsApp
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Proceed to Payment
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
