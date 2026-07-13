import { useState, useEffect, useRef } from 'react';
import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Copy, Check, Clock, Phone, CreditCard, ShoppingBag, ClipboardPaste, Download, AlertCircle, FileText, ExternalLink, Wallet, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS, storageGet, storageRemove, storageSet } from '@/lib/persist';
import storeLogo from '@/assets/logo-with-patrichia.png';

interface OrderItem {
  id: string;
  product_name: string;
  size: string;
  quantity: number;
  price_at_purchase: number;
  color?: string | null;
}

interface LocationState {
  orderId: string;
  trackingCode: string | null;
  total: number;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
}

type PaymentMethod = 'pesapal' | 'mpesa';

// Parse M-Pesa confirmation message
const parseMpesaMessage = (message: string) => {
  const amountMatch = message.match(/Ksh[\s]?([\d,]+(?:\.\d{2})?)/i);
  const confirmCodeMatch = message.match(/^([A-Z0-9]{10})/);
  const confirmedMatch = message.toLowerCase().includes('confirmed');
  
  return {
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    confirmCode: confirmCodeMatch ? confirmCodeMatch[1] : null,
    isConfirmed: confirmedMatch,
  };
};

export default function Payment() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = location.state as LocationState | null;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pesapal');
  const [copiedPaybill, setCopiedPaybill] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [orderDetails, setOrderDetails] = useState<LocationState | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [complaintText, setComplaintText] = useState('');
  const [showComplaintForm, setShowComplaintForm] = useState(false);
  const [isPesapalLoading, setIsPesapalLoading] = useState(false);
  const [pesapalTrackingId, setPesapalTrackingId] = useState<string | null>(null);
  const [pollingStatus, setPollingStatus] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pesapalSubmittingRef = useRef(false);

  const PAYBILL_NUMBER = '247247';
  const ACCOUNT_NUMBER = '0726075180';
  const WHATSAPP_NUMBER = '254726075180';

  // Stop polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);


  useEffect(() => {
    const effectiveState = state ?? storageGet<LocationState>(STORAGE_KEYS.pendingOrder);

    if (effectiveState) {
      setOrderDetails(effectiveState);
      storageSet(STORAGE_KEYS.pendingOrder, effectiveState);

      // Fetch order items
      const fetchOrderItems = async () => {
        const { data, error } = await supabase
          .from('order_items')
          .select('id, product_name, size, quantity, price_at_purchase, color')
          .eq('order_id', effectiveState.orderId);

        if (!error && data) setOrderItems(data);
      };
      fetchOrderItems();
    }

    // Check if returning from Pesapal redirect
    const orderTrackingId = searchParams.get('OrderTrackingId');
    const orderMerchantRef = searchParams.get('OrderMerchantReference');
    
    if (orderTrackingId && effectiveState) {
      setPesapalTrackingId(orderTrackingId);
      setPaymentMethod('pesapal');
      // Auto-verify on return from Pesapal
      pollPesapalStatus(orderTrackingId, orderMerchantRef || effectiveState.orderId);
    }

    // Also restore pesapal tracking ID from storage
    const storedTrackingId = storageGet<string>(STORAGE_KEYS.pesapalTrackingId);
    if (storedTrackingId && !orderTrackingId) {
      setPesapalTrackingId(storedTrackingId);
    }
  }, [state, searchParams]);

  const pollPesapalStatus = (trackingId: string, orderId: string) => {
    setIsVerifying(true);
    setPollingStatus('Checking payment status...');
    let attempts = 0;
    const maxAttempts = 20; // Poll for ~60 seconds

    const poll = async () => {
      attempts++;
      try {
        const { data, error } = await supabase.functions.invoke('pesapal-status', {
          body: { orderTrackingId: trackingId, orderId },
        });

        if (error) throw error;

        if (data?.status === 'confirmed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setPaymentVerified(true);
          setIsVerifying(false);
          setPollingStatus(null);
          storageRemove(STORAGE_KEYS.pendingOrder);
          storageRemove(STORAGE_KEYS.pesapalTrackingId);
          toast.success('Payment confirmed automatically! Download your receipt below.');
          return;
        }

        if (data?.status === 'failed') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsVerifying(false);
          setPollingStatus(null);
          toast.error('Payment failed. Please try again or use M-Pesa Paybill.');
          return;
        }

        setPollingStatus(`Waiting for payment confirmation... (${attempts}/${maxAttempts})`);

        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsVerifying(false);
          setPollingStatus(null);
          toast.info('Payment verification is taking longer than expected. It will be confirmed automatically when processed.');
        }
      } catch (err) {
        console.error('Poll error:', err);
        if (attempts >= maxAttempts) {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setIsVerifying(false);
          setPollingStatus(null);
        }
      }
    };

    // Immediate check + interval
    poll();
    pollingRef.current = setInterval(poll, 3000);
  };

  const copyToClipboard = async (text: string, type: 'paybill' | 'account') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'paybill') {
        setCopiedPaybill(true);
        setTimeout(() => setCopiedPaybill(false), 2000);
      } else {
        setCopiedAccount(true);
        setTimeout(() => setCopiedAccount(false), 2000);
      }
      toast.success('Copied to clipboard!');
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handlePasteMessage = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setMpesaMessage(text);
      toast.success('Message pasted!');
    } catch (error) {
      toast.error('Failed to paste. Please paste manually.');
    }
  };

  const verifyMpesaPayment = async () => {
    if (!mpesaMessage.trim() || !orderDetails) return;

    setIsVerifying(true);
    const parsed = parseMpesaMessage(mpesaMessage);

    if (!parsed.isConfirmed) {
      toast.error('This does not appear to be a valid M-Pesa confirmation message');
      setIsVerifying(false);
      return;
    }

    if (!parsed.amount) {
      toast.error('Could not detect the amount in the message');
      setIsVerifying(false);
      return;
    }

    if (parsed.amount !== orderDetails.total) {
      toast.error(`Payment amount Ksh ${parsed.amount.toLocaleString()} doesn't match required Ksh ${orderDetails.total.toLocaleString()}.`);
      setIsVerifying(false);
      return;
    }

    if (!parsed.confirmCode) {
      toast.error('Could not detect M-Pesa confirmation code');
      setIsVerifying(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('confirm-payment', {
        body: {
          orderId: orderDetails.orderId,
          amount: parsed.amount,
          mpesaCode: parsed.confirmCode,
          customerName: orderDetails.customerName,
          customerPhone: orderDetails.customerPhone || null,
          paymentMethod: 'mpesa',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        setIsVerifying(false);
        return;
      }

      storageRemove(STORAGE_KEYS.pendingOrder);
      setPaymentVerified(true);
      toast.success('Payment verified successfully! Download your receipt below.');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to verify payment. Please contact support.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handlePesapalPayment = async () => {
    if (!orderDetails) return;
    // Hard guard against double-submit (button disable + ref-lock)
    if (pesapalSubmittingRef.current || isPesapalLoading) return;
    pesapalSubmittingRef.current = true;
    setIsPesapalLoading(true);

    try {
      // Build callback URL - current page URL so user returns here
      const currentUrl = window.location.origin + '/payment';

      const { data, error } = await supabase.functions.invoke('pesapal-pay', {
        body: {
          orderId: orderDetails.orderId,
          amount: orderDetails.total,
          customerName: orderDetails.customerName,
          customerPhone: orderDetails.customerPhone || '',
          callbackUrl: currentUrl,
        },
      });

      if (error) throw error;

      if (!data?.redirect_url) {
        toast.error('Failed to initiate Pesapal payment. Try M-Pesa Paybill instead.');
        setIsPesapalLoading(false);
        return;
      }

      // Store tracking ID for when user returns
      if (data.order_tracking_id) {
        storageSet(STORAGE_KEYS.pesapalTrackingId, data.order_tracking_id);
        setPesapalTrackingId(data.order_tracking_id);
      }

      // Redirect user to Pesapal payment page
      window.location.href = data.redirect_url;
    } catch (error) {
      console.error('Error initiating Pesapal payment:', error);
      toast.error('Failed to initiate payment. Please try M-Pesa Paybill instead.');
    } finally {
      setIsPesapalLoading(false);
      pesapalSubmittingRef.current = false;
    }
  };

  const generateReceipt = () => {
    if (!orderDetails) return;

    const itemsHTML = orderItems.map(item => `
      <div class="row">
        <span>${item.product_name} (${item.size})${item.color ? ` - ${item.color}` : ''}</span>
        <span>×${item.quantity}</span>
        <span class="value">Ksh ${item.price_at_purchase.toLocaleString()}</span>
      </div>
    `).join('');

    const paymentMethodLabel = paymentMethod === 'pesapal' ? 'Pesapal' : 'M-Pesa Paybill';

    const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - Patrichia's Store</title>
  <style>
    body { font-family: 'Georgia', 'Times New Roman', serif; padding: 40px; max-width: 480px; margin: 0 auto; color: #1e1e28; background: #fff; }
    .header { text-align: center; margin-bottom: 24px; background: #0B1736; color: #D4AF37; padding: 22px 16px; border-radius: 10px; border-bottom: 3px solid #D4AF37; }
    .store-name { color: #D4AF37; font-size: 26px; font-weight: bold; margin: 8px 0 4px; letter-spacing: 0.5px; }
    .tagline { color: #e6dcbe; font-size: 12px; margin: 0; }
    .section { margin: 16px 0; padding: 16px; background: #f7f5ee; border-radius: 8px; border-left: 3px solid #D4AF37; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; gap: 10px; font-family: Arial, sans-serif; font-size: 14px; }
    .label { color: #6b6b7a; }
    .value { font-weight: bold; color: #0B1736; }
    .total-row { background: #0B1736; color: #D4AF37; padding: 14px 16px; border-radius: 8px; margin-top: 12px; display:flex; justify-content:space-between; align-items:center; }
    .total-row .label { color: #e6dcbe; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }
    .total-row .value { color: #D4AF37; font-size: 20px; font-family: Georgia, serif; }
    .status { background: #D4AF37; color: #0B1736; padding: 4px 12px; border-radius: 20px; display: inline-block; font-weight: bold; font-size: 12px; }
    .items-section { margin: 16px 0; padding: 16px; background: #fbf8ec; border-radius: 8px; border: 1px solid #ecdca8; }
    .items-title { font-weight: bold; margin-bottom: 10px; color: #0B1736; font-family: Georgia, serif; letter-spacing: 0.5px; }
    .footer { text-align: center; margin-top: 28px; padding-top: 16px; border-top: 1px solid #D4AF37; color: #6b6b7a; font-size: 12px; font-family: Arial, sans-serif; }
    .footer strong { color: #0B1736; }
    .payment-method { background: #0B1736; color: #D4AF37; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <div style="width:72px;height:72px;margin:0 auto 10px;">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" fill="#D4AF37"/>
        <text x="50" y="62" font-size="42" fill="#0B1736" text-anchor="middle" font-weight="bold" font-family="Georgia, serif">P</text>
      </svg>
    </div>
    <h1 class="store-name">Patrichia's Store</h1>
    <p class="tagline">Quality School Uniforms · Nairobi, Kenya</p>
  </div>
  
  <div class="section">
    <div class="row"><span class="label">Customer:</span><span class="value">${orderDetails.customerName}</span></div>
    <div class="row"><span class="label">Order ID:</span><span class="value">${orderDetails.orderId.slice(0, 8)}</span></div>
    <div class="row"><span class="label">Tracking:</span><span class="value">${orderDetails.trackingCode || 'N/A'}</span></div>
    <div class="row"><span class="label">Date:</span><span class="value">${new Date().toLocaleDateString()}</span></div>
    <div class="row"><span class="label">Payment:</span><span class="payment-method">${paymentMethodLabel}</span></div>
  </div>

  <div class="items-section">
    <p class="items-title">Items Ordered</p>
    ${itemsHTML || '<p>No items</p>'}
  </div>
  
  <div class="section">
    <div class="row"><span class="label">Status:</span><span class="status">PAID ✓</span></div>
    <div class="total-row"><span class="label">Amount Paid</span><span class="value">Ksh ${orderDetails.total.toLocaleString()}</span></div>
  </div>
  
  <div class="footer">
    <p><strong>Thank you for shopping with us.</strong></p>
    <p>Uhuru Market, Store F47 · Nairobi</p>
    <p>0726075180</p>
  </div>
</body>
</html>`;

    const blob = new Blob([receiptHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${orderDetails.trackingCode || orderDetails.orderId.slice(0, 8)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded!');
  };

  const handleSendComplaint = () => {
    if (!orderDetails || !complaintText.trim()) {
      toast.error('Please describe your complaint');
      return;
    }

    const itemsList = orderItems.map(item => 
      `• ${item.product_name} (${item.size}) ×${item.quantity}${item.color ? ` - ${item.color}` : ''}`
    ).join('\n');

    const message = encodeURIComponent(
      `🚨 COMPLAINT - Patrichia's Store\n\n` +
      `👤 Customer: ${orderDetails.customerName}\n` +
      `🔖 Tracking: ${orderDetails.trackingCode || 'N/A'}\n` +
      `💰 Amount: Ksh ${orderDetails.total.toLocaleString()}\n` +
      `📅 Date: ${new Date().toLocaleDateString()}\n\n` +
      `📦 Items:\n${itemsList}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 COMPLAINT:\n${complaintText}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ Please download and attach my receipt PDF from the website.`
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
    toast.success('Opening WhatsApp...');
  };

  if (!orderDetails) {
    return (
      <Layout>
        <div className="container-shop py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No order found</h2>
            <p className="text-muted-foreground mb-6">Please start a new order from our shop.</p>
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
          {/* Header */}
          <div className="text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${paymentVerified ? 'bg-green-100' : 'bg-primary/10'}`}>
              {paymentVerified ? (
                <Check className="h-8 w-8 text-green-600" />
              ) : isVerifying ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <CreditCard className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {paymentVerified ? 'Payment Confirmed!' : isVerifying ? 'Verifying Payment...' : 'Complete Your Payment'}
              </h1>
              <p className="text-muted-foreground">
                {paymentVerified 
                  ? 'Thank you! Your order has been confirmed.' 
                  : isVerifying 
                    ? pollingStatus || 'Checking with payment provider...'
                    : `Hi ${orderDetails.customerName}, choose your payment method below.`}
              </p>
            </div>
          </div>

          {/* Order Details */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">Ksh {orderDetails.total.toLocaleString()}</p>
                </div>
                <Badge 
                  variant={paymentVerified ? "default" : "secondary"} 
                  className={`flex items-center gap-1 ${paymentVerified ? 'bg-green-600' : ''}`}
                >
                  {paymentVerified ? (
                    <><Check className="h-3 w-3" /> Paid</>
                  ) : isVerifying ? (
                    <><Loader2 className="h-3 w-3 animate-spin" /> Verifying</>
                  ) : (
                    <><Clock className="h-3 w-3" /> Awaiting Payment</>
                  )}
                </Badge>
              </div>
              {orderDetails.trackingCode && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Order Tracking Code:</p>
                  <p className="font-mono font-bold text-lg">{orderDetails.trackingCode}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Options */}
          {!paymentVerified && !isVerifying && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Choose Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={paymentMethod}
                    onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}
                    className="space-y-3"
                  >
                    <label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'pesapal' ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'}`}>
                      <RadioGroupItem value="pesapal" />
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">💳 Pesapal (Automated)</p>
                        <p className="text-sm text-muted-foreground">Pay via M-Pesa STK push. Auto-verified instantly.</p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Recommended</Badge>
                    </label>

                    <label className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === 'mpesa' ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'}`}>
                      <RadioGroupItem value="mpesa" />
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">🏦 M-Pesa Paybill</p>
                        <p className="text-sm text-muted-foreground">Manual Paybill payment. Paste SMS to verify.</p>
                      </div>
                      <Badge variant="outline">Fallback</Badge>
                    </label>
                  </RadioGroup>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold">Important:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Pay the <strong>exact amount: Ksh {orderDetails.total.toLocaleString()}</strong></li>
                        <li>Underpayment or overpayment will be rejected</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pesapal Flow */}
              {paymentMethod === 'pesapal' && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Wallet className="h-5 w-5" />
                      Pay with Pesapal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <p className="text-sm text-muted-foreground mb-2">Amount to Pay:</p>
                      <p className="text-3xl font-bold text-green-600">Ksh {orderDetails.total.toLocaleString()}</p>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-semibold text-green-800">How it works:</h4>
                      <ol className="space-y-2 text-sm">
                        {[
                          'Click "Pay Now" — you\'ll be redirected to Pesapal',
                          'Enter your M-Pesa number and approve the STK push',
                          'You\'ll be redirected back here automatically',
                          'Payment is verified automatically — receipt ready!',
                        ].map((step, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0 text-xs">{i + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>

                    <Button
                      onClick={handlePesapalPayment}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                      disabled={isPesapalLoading}
                    >
                      {isPesapalLoading ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Connecting to Pesapal...</>
                      ) : (
                        <><ExternalLink className="h-4 w-4 mr-2" /> Pay Now with Pesapal</>
                      )}
                    </Button>

                    {pesapalTrackingId && !isVerifying && (
                      <Button
                        onClick={() => pollPesapalStatus(pesapalTrackingId, orderDetails.orderId)}
                        variant="outline"
                        className="w-full"
                      >
                        <Check className="h-4 w-4 mr-2" />
                        Check Payment Status
                      </Button>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                      <p className="text-sm text-blue-800">
                        Having trouble? Use the <strong>M-Pesa Paybill</strong> option as a fallback.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* M-Pesa Paybill Flow */}
              {paymentMethod === 'mpesa' && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        M-Pesa Paybill Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="bg-muted rounded-lg p-6 space-y-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Paybill Number</p>
                            <p className="text-3xl font-bold font-mono">{PAYBILL_NUMBER}</p>
                          </div>
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(PAYBILL_NUMBER, 'paybill')} className="h-12 w-12">
                            {copiedPaybill ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                          </Button>
                        </div>
                        <div className="border-t" />
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Account Number</p>
                            <p className="text-3xl font-bold font-mono">{ACCOUNT_NUMBER}</p>
                          </div>
                          <Button variant="outline" size="icon" onClick={() => copyToClipboard(ACCOUNT_NUMBER, 'account')} className="h-12 w-12">
                            {copiedAccount ? <Check className="h-5 w-5 text-green-600" /> : <Copy className="h-5 w-5" />}
                          </Button>
                        </div>
                        <div className="border-t" />
                        <div>
                          <p className="text-sm text-muted-foreground">Exact Amount to Pay</p>
                          <p className="text-3xl font-bold text-primary font-mono">Ksh {orderDetails.total.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h3 className="font-semibold">How to Pay via M-Pesa</h3>
                        <div className="space-y-3">
                          {[
                            'Go to M-Pesa on your phone',
                            'Select Lipa na M-Pesa → Pay Bill',
                            `Enter Business Number: ${PAYBILL_NUMBER}`,
                            `Enter Account Number: ${ACCOUNT_NUMBER}`,
                            `Enter EXACT Amount: Ksh ${orderDetails.total.toLocaleString()}`,
                            'Enter your M-Pesa PIN and confirm',
                          ].map((step, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                <span className="text-sm font-medium text-primary">{index + 1}</span>
                              </div>
                              <p className="text-sm">{step}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ClipboardPaste className="h-5 w-5" />
                        Verify Your Payment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted/50 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <p className="text-sm">
                          After paying, paste your M-Pesa confirmation SMS below to verify payment and download your receipt.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Button variant="outline" onClick={handlePasteMessage} className="flex items-center gap-2">
                          <ClipboardPaste className="h-4 w-4" />
                          Paste Message
                        </Button>
                        <Textarea
                          placeholder="Paste your M-Pesa confirmation SMS here..."
                          value={mpesaMessage}
                          onChange={(e) => setMpesaMessage(e.target.value)}
                          className="min-h-[100px]"
                        />
                      </div>

                      <Button
                        onClick={verifyMpesaPayment}
                        disabled={isVerifying || !mpesaMessage.trim()}
                        className="w-full bg-primary hover:bg-primary/90"
                        size="lg"
                      >
                        {isVerifying ? 'Verifying...' : '✓ Verify Payment & Download Receipt'}
                      </Button>
                    </CardContent>
                  </Card>
                </>
              )}

              <p className="text-center text-sm text-muted-foreground">
                ⚠️ Having trouble? Try the {paymentMethod === 'pesapal' ? 'M-Pesa Paybill' : 'Pesapal'} option instead.
              </p>
            </>
          )}

          {/* Payment Verified */}
          {paymentVerified && (
            <Card className="border-green-500 bg-green-50">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Check className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-green-800">Payment Verified!</h3>
                    <p className="text-sm text-green-700">Your order has been confirmed</p>
                  </div>
                </div>

                <Button onClick={generateReceipt} className="w-full bg-green-600 hover:bg-green-700" size="lg">
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>

                <div className="pt-4 border-t border-green-200">
                  <p className="text-sm text-green-700 mb-3">
                    Have an issue? Download your receipt first, then send a complaint:
                  </p>
                  
                  {!showComplaintForm ? (
                    <Button variant="outline" onClick={() => setShowComplaintForm(true)} className="w-full border-green-600 text-green-700 hover:bg-green-100">
                      <FileText className="h-4 w-4 mr-2" />
                      Send Complaint
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Describe your complaint in detail..."
                        value={complaintText}
                        onChange={(e) => setComplaintText(e.target.value)}
                        className="min-h-[100px] bg-white"
                      />
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => { setShowComplaintForm(false); setComplaintText(''); }} className="flex-1">
                          Cancel
                        </Button>
                        <Button onClick={handleSendComplaint} disabled={!complaintText.trim()} className="flex-1 bg-green-600 hover:bg-green-700">
                          Send via WhatsApp
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-center pt-2">
                  <Button variant="link" asChild>
                    <Link to="/track-order">Track Your Order →</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help */}
          <div className="text-center">
            <Button
              variant="link"
              className="text-muted-foreground"
              onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hello! I need help with my payment.')}`, '_blank')}
            >
              <Phone className="h-4 w-4 mr-1" />
              Need help? Contact us on WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
