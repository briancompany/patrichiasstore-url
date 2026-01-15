import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { CartItem } from '@/types/product';
import { MessageCircle, ShoppingBag } from 'lucide-react';

const WHATSAPP_NUMBER = '254700000000';

export default function Order() {
  const location = useLocation();
  const cartItems: CartItem[] = location.state?.cart || [];
  
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    school: '',
    deliveryType: 'pickup' as 'pickup' | 'delivery',
    location: '',
  });

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const generateWhatsAppMessage = () => {
    const itemsList = cartItems
      .map(
        (item) =>
          `• ${item.product.name} (${item.product.school})\n  Size: ${item.selectedSize}, Qty: ${item.quantity}, Price: Ksh ${item.price.toLocaleString()}`
      )
      .join('\n\n');

    const message = `Hello Patrichia's Store! 👋

I would like to place an order:

*Customer Details:*
Name: ${formData.fullName}
Phone: ${formData.phone}
School: ${formData.school}

*Order Items:*
${itemsList}

*Total: Ksh ${cartTotal.toLocaleString()}*

*Delivery:* ${formData.deliveryType === 'pickup' ? 'Pickup at Store F47, Uhuru Market' : `Delivery to: ${formData.location}`}

Thank you! 🙏`;

    return encodeURIComponent(message);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = generateWhatsAppMessage();
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  const isFormValid =
    formData.fullName &&
    formData.phone &&
    formData.school &&
    (formData.deliveryType === 'pickup' || formData.location);

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">Place Your Order</h1>
          <p className="text-muted-foreground mb-8">Fill in your details and complete your order via WhatsApp</p>

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
              <div className="bg-muted rounded-xl p-4">
                <h3 className="font-semibold mb-3">Order Summary</h3>
                <div className="space-y-2">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {item.product.name} ({item.selectedSize}) x{item.quantity}
                      </span>
                      <span className="font-medium">Ksh {item.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border mt-3 pt-3 flex justify-between">
                  <span className="font-semibold">Total:</span>
                  <span className="price-tag">Ksh {cartTotal.toLocaleString()}</span>
                </div>
              </div>

              {/* Customer Details */}
              <div className="space-y-4">
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
                  <Label htmlFor="school">School Name *</Label>
                  <Input
                    id="school"
                    name="school"
                    value={formData.school}
                    onChange={handleInputChange}
                    placeholder="Enter the school name"
                    required
                  />
                </div>
              </div>

              {/* Delivery Options */}
              <div className="space-y-3">
                <Label>How would you like to receive your order? *</Label>
                <RadioGroup
                  value={formData.deliveryType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, deliveryType: value as 'pickup' | 'delivery' }))
                  }
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="pickup" id="pickup" />
                    <Label htmlFor="pickup" className="cursor-pointer flex-1">
                      <span className="font-medium">Pickup at Store</span>
                      <p className="text-sm text-muted-foreground">Store F47, Uhuru Market</p>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                    <RadioGroupItem value="delivery" id="delivery" />
                    <Label htmlFor="delivery" className="cursor-pointer flex-1">
                      <span className="font-medium">Delivery</span>
                      <p className="text-sm text-muted-foreground">We'll deliver to your location</p>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

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

              {/* Submit */}
              <Button
                type="submit"
                disabled={!isFormValid}
                className="w-full btn-whatsapp gap-2 h-12 text-lg"
              >
                <MessageCircle className="h-5 w-5" />
                Complete Order on WhatsApp
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                You'll be redirected to WhatsApp to finalize your order with us.
              </p>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
