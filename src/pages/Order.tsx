import { useEffect, useRef, useState } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CartItem } from '@/types/product';
import { AlertTriangle, CreditCard, ShoppingBag, Store, MapPin, Loader2, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { createUuid, isUuid } from '@/lib/uuid';
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from '@/lib/persist';
import { searchSchoolsFromDB, type DBSchoolResult } from '@/lib/api/schoolSearch';
import { checkStockAvailability } from '@/hooks/useLiveStock';
import { DeliveryLocationPicker } from '@/components/DeliveryLocationPicker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const getBackendErrorMessage = (err: unknown) => {
  const e = err as { message?: string; details?: string; hint?: string; code?: string } | null;
  const parts = [e?.message, e?.details, e?.hint].filter(Boolean);
  if (parts.length > 0) return parts.join(' • ');
  return 'Could not save your order. Please check your connection and try again.';
};

export default function Order() {
  const location = useLocation();
  const navigate = useNavigate();

  const navState = location.state as { cart?: CartItem[]; isSpecialOrder?: boolean; specialOrderNote?: string; chatSessionId?: string } | null;
  const navCart = navState?.cart;
  const isChatbotSpecialOrder = Boolean(navState?.isSpecialOrder);
  const chatbotSpecialOrderNote = navState?.specialOrderNote || null;
  const [cartItems] = useState<CartItem[]>(() => navCart ?? storageGet<CartItem[]>(STORAGE_KEYS.shopCart) ?? []);

  useEffect(() => {
    if (navCart && navCart.length > 0) storageSet(STORAGE_KEYS.shopCart, navCart);
  }, [navCart]);

  const [paymentMethod, setPaymentMethod] = useState<'pesapal' | 'mpesa' | 'cash'>('pesapal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shortfalls, setShortfalls] = useState<{
    product_id: string; product_name: string; requested: number; available: number;
  }[]>([]);
  const [showSpecialDialog, setShowSpecialDialog] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const confirmedShortfallsRef = useRef<typeof shortfalls | null>(null);
  const [schoolSuggestions, setSchoolSuggestions] = useState<DBSchoolResult[]>([]);
  const [showSchoolSuggestions, setShowSchoolSuggestions] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    school: '',
    deliveryType: 'pickup' as 'pickup' | 'delivery',
    location: '',
    notes: '',
  });

  useEffect(() => {
    const query = formData.school.trim();
    if (selectedSchoolId) {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
      return;
    }
    if (query.length < 2) {
      setSchoolSuggestions([]);
      setShowSchoolSuggestions(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const results = await searchSchoolsFromDB(query);
      if (!cancelled) {
        setSchoolSuggestions(results);
        setShowSchoolSuggestions(true);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [formData.school, selectedSchoolId]);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.price, 0);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'school') setSelectedSchoolId(null);
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
      // Re-check stock immediately before checkout. If there is a shortage,
      // ask the customer how to handle it before creating a priority order.
      const confirmedShortfalls = confirmedShortfallsRef.current;
      confirmedShortfallsRef.current = null;
      const stockCheck = confirmedShortfalls
        ? { ok: false, unavailable: confirmedShortfalls }
        : await checkStockAvailability(
            cartItems
              .filter((item) => isUuid(item.product.id))
              .map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
          );
      if (!confirmedShortfalls && stockCheck.unavailable.length > 0) {
        setShortfalls(stockCheck.unavailable);
        setShowSpecialDialog(true);
        setIsSubmitting(false);
        return;
      }
      const shortfallByProduct = new Map(
        stockCheck.unavailable.map((item) => [item.product_id, item]),
      );
      const isSpecialOrder = isChatbotSpecialOrder || stockCheck.unavailable.length > 0;
      const liveShortfallNote = stockCheck.unavailable.map((item) =>
        `${item.product_name}: requested ${item.requested}, available ${item.available}`
      ).join('; ');
      const finalSpecialOrderNote = [
        chatbotSpecialOrderNote,
        specialNote.trim(),
        liveShortfallNote ? `Live stock check — ${liveShortfallNote}` : '',
      ].filter(Boolean).join(' | ') || null;

      // Create the order (generate UUID client-side to avoid relying on returned rows)
      const orderId = createUuid();

      const { error: orderError } = await supabase
        .from('orders')
        // NOTE: Do not chain .select() here; returning the inserted row can fail under stricter RLS in production.
        .insert({
          id: orderId,
          customer_name: formData.fullName,
          customer_phone: formData.phone,
          customer_school: formData.school || null,
          delivery_type: formData.deliveryType,
          delivery_location: formData.deliveryType === 'delivery' ? formData.location : null,
          notes: formData.notes || null,
          total_amount: cartTotal,
          payment_method: paymentMethod,
          payment_status: 'pending',
          is_special_order: isSpecialOrder,
          special_order_note: isSpecialOrder ? finalSpecialOrderNote : null,
          is_new_school: Boolean(formData.school.trim() && !selectedSchoolId),
          linked_school_id: selectedSchoolId,
          // Order must be saved first; payment comes after
          status: formData.school.trim() && !selectedSchoolId ? 'new_school_setup' : 'pending',
        });

      if (orderError) throw orderError;

      const { error: contactError } = await supabase.rpc('upsert_order_contact_email', {
        _order_id: orderId,
        _customer_email: formData.email,
        _customer_name: formData.fullName,
        _customer_phone: formData.phone,
      });

      if (contactError) throw contactError;

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
        shortfall_quantity: Math.max(0, shortfallByProduct.has(item.product.id) ? item.quantity - (shortfallByProduct.get(item.product.id)?.available ?? 0) : 0),
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

      if (itemsError) throw itemsError;

      // Convert the pending chatbot lead into this real order so the admin
      // notification count does not double-count the same request.
      if (isChatbotSpecialOrder && navState?.chatSessionId) {
        const { error: linkError } = await supabase.rpc('mark_chat_special_order_converted', {
          _session_id: navState.chatSessionId,
          _order_id: orderId,
        });
        if (linkError) console.warn('Could not link chatbot special-order lead:', linkError);
      }

      // Generate tracking code (best-effort)
      const trackingCode = generateTrackingCode();
      const { error: trackingError } = await supabase.from('order_tracking').insert({
        order_id: orderId,
        tracking_code: trackingCode,
      });

      if (trackingError) {
        console.warn('Tracking insert failed (continuing):', trackingError);
      }

      supabase.functions.invoke('send-delivery-update', {
        body: { orderId, statusUpdate: formData.school.trim() && !selectedSchoolId ? 'new_school_setup' : 'pending' },
      }).catch(() => undefined);

      const paymentState = {
        orderId,
        trackingCode: trackingError ? null : trackingCode,
        total: cartTotal,
        customerName: formData.fullName,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        paymentMethod,
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
          <p className="text-muted-foreground mb-8">Fill in your details and choose how you'd like to pay</p>

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
            <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
              {isChatbotSpecialOrder && (
            <Card className="border-destructive/40 bg-destructive/5">
              <CardContent className="p-4 text-sm">
                <p className="font-semibold text-destructive">Special order request</p>
                <p className="mt-1 text-muted-foreground">The store team will see this order as a priority request.</p>
                {chatbotSpecialOrderNote && <p className="mt-2">{chatbotSpecialOrderNote}</p>}
              </CardContent>
            </Card>
          )}

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

                  <div className="relative">
                    <Label htmlFor="school">School Name (Optional)</Label>
                    <Input
                      id="school"
                      name="school"
                      value={formData.school}
                      onChange={handleInputChange}
                      onFocus={() => schoolSuggestions.length > 0 && setShowSchoolSuggestions(true)}
                      placeholder="Search schools registered in our store"
                      autoComplete="off"
                    />
                    {showSchoolSuggestions && formData.school.trim().length >= 2 && (
                      <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
                        {schoolSuggestions.length > 0 ? schoolSuggestions.map((school) => (
                          <button
                            key={school.id}
                            type="button"
                            className="flex w-full items-center rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                            onClick={() => {
                              setFormData((prev) => ({ ...prev, school: school.name }));
                              setSelectedSchoolId(school.id);
                              setShowSchoolSuggestions(false);
                            }}
                          >
                            {school.name}
                          </button>
                        )) : (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            No matching registered school. You can continue with this name as a new school.
                          </p>
                        )}
                      </div>
                    )}
                    {formData.school.trim() && selectedSchoolId && (
                      <p className="mt-1 text-xs text-emerald-600">Registered school selected</p>
                    )}
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
                    <DeliveryLocationPicker
                      id="location"
                      value={formData.location}
                      onChange={(location) => setFormData((prev) => ({ ...prev, location }))}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Payment Method */}
              <Card>
                <CardHeader><CardTitle>Choose Payment Method</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as 'pesapal' | 'mpesa' | 'cash')} className="space-y-3">
                    <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer"><RadioGroupItem value="pesapal" /><CreditCard className="h-5 w-5 text-primary" /><span className="flex-1"><strong>Pesapal</strong><span className="block text-sm text-muted-foreground">Pay securely online.</span></span></label>
                    <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer"><RadioGroupItem value="mpesa" /><Phone className="h-5 w-5 text-primary" /><span className="flex-1"><strong>M-Pesa Paybill</strong><span className="block text-sm text-muted-foreground">Pay manually using the store Paybill.</span></span></label>
                    <label className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer"><RadioGroupItem value="cash" /><Store className="h-5 w-5 text-primary" /><span className="flex-1"><strong>Cash (Pay later)</strong><span className="block text-sm text-muted-foreground">Pay when visiting the shop or when receiving your order.</span></span></label>
                  </RadioGroup>
                  <p className="text-sm text-muted-foreground">Payment is not required for your order to be placed successfully. You can pay later if you choose Cash (Pay later).</p>
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
                    Place Order
                  </>
                )}
              </Button>

              <p className="text-sm text-muted-foreground text-center">
                Your order will be saved first. You can pay now or later using your selected method.
              </p>
            </form>
          )}
        </div>
      </div>

      <Dialog open={showSpecialDialog} onOpenChange={setShowSpecialDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Some items are short on stock
            </DialogTitle>
            <DialogDescription>
              You can still place this order. It will be marked as a priority special order so our
              team restocks and contacts you first.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              {shortfalls.map((item) => (
                <div key={item.product_id} className="text-sm">
                  <p className="font-medium">{item.product_name}</p>
                  <p className="text-muted-foreground">
                    {item.available === 0
                      ? `Out of stock · you asked for ${item.requested}`
                      : `Only ${item.available} left · you asked for ${item.requested}`}
                  </p>
                </div>
              ))}
            </div>

            <div>
              <Label htmlFor="specialOrderNote">Tell us how to handle it (optional)</Label>
              <Textarea
                id="specialOrderNote"
                value={specialNote}
                onChange={(e) => setSpecialNote(e.target.value)}
                placeholder="e.g. I still need all 5 pieces by Friday, or send what's available first"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowSpecialDialog(false)} disabled={isSubmitting}>
              Go back
            </Button>
            <Button
              onClick={() => {
                confirmedShortfallsRef.current = shortfalls;
                setShowSpecialDialog(false);
                formRef.current?.requestSubmit();
              }}
              disabled={isSubmitting}
            >
              Proceed as special order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </Layout>
  );
}
