import { useState, useEffect } from 'react';
import { useLocation, Link, useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Copy, Check, Clock, Phone, CreditCard, ShoppingBag, ClipboardPaste, Download, AlertCircle, FileText, ExternalLink, Wallet, Building2 } from 'lucide-react';
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
}

type PaymentMethod = 'pesapal' | 'mpesa';

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
  const [pesapalCode, setPesapalCode] = useState('');

  const PAYBILL_NUMBER = '247247';
  const ACCOUNT_NUMBER = '0726075180';
  const WHATSAPP_NUMBER = '254726075180';
  const PESAPAL_URL = 'https://store.pesapal.com/patrichiastorepaymentpage';

  useEffect(() => {
    const effectiveState = state ?? storageGet<LocationState>(STORAGE_KEYS.pendingOrder);

    if (effectiveState) {
      setOrderDetails(effectiveState);
      storageSet(STORAGE_KEYS.pendingOrder, effectiveState);

      // Fetch order items (best-effort)
      const fetchOrderItems = async () => {
        const { data, error } = await supabase
          .from('order_items')
          .select('id, product_name, size, quantity, price_at_purchase, color')
          .eq('order_id', effectiveState.orderId);

        if (!error && data) {
          setOrderItems(data);
        }
      };
      fetchOrderItems();
    }

    // Redirect-based Pesapal: auto-detect code and auto-run verification (no manual button needed)
    const urlCode = searchParams.get('ref') || searchParams.get('code');
    if (urlCode) {
      const normalized = urlCode.toUpperCase();
      setPaymentMethod('pesapal');
      setPesapalCode(normalized);

      if (effectiveState) {
        // Defer so state updates apply before verification
        setTimeout(() => {
          confirmPesapalPayment({ order: effectiveState, code: normalized });
        }, 0);
      } else {
        toast.info('Transaction code detected. Return to checkout to load your order, then we will auto-verify.');
      }
    }
  }, [state, searchParams]);

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
    if (!mpesaMessage.trim()) {
      toast.error('Please paste your M-Pesa confirmation message');
      return;
    }

    if (!orderDetails) return;

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('secure-payment-confirmation', {
        body: {
          orderId: orderDetails.orderId,
          paymentMethod: 'mpesa',
          mpesaMessage,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Payment verification failed');
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

  const handlePesapalPayment = () => {
    // Open Pesapal in new tab - the store payment page handles STK push internally
    window.open(PESAPAL_URL, '_blank');
    toast.info('Complete your payment on Pesapal, then enter your M-Pesa code here.');
  };

  const confirmPesapalPayment = async (opts?: { order?: LocationState; code?: string }) => {
    const effectiveOrder = opts?.order ?? orderDetails;
    const effectiveCode = (opts?.code ?? pesapalCode).trim().toUpperCase();

    if (!effectiveOrder) return;

    if (!effectiveCode) {
      toast.error('Missing transaction code.');
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.functions.invoke('secure-payment-confirmation', {
        body: {
          orderId: effectiveOrder.orderId,
          paymentMethod: 'pesapal',
          transactionCode: effectiveCode,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Payment verification failed');
      }

      storageRemove(STORAGE_KEYS.pendingOrder);
      setPaymentVerified(true);
      toast.success('Payment verified! Your receipt is ready for download.');
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error('Failed to verify payment. Please try the M-Pesa Paybill fallback.');
    } finally {
      setIsVerifying(false);
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

    const paymentMethodLabel = paymentMethod === 'pesapal' ? 'Pesapal STK Push' : 'M-Pesa Paybill';

    // Create a visual receipt as HTML and convert to downloadable format
    const receiptHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt - Patrichia's Store</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; max-width: 450px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #7c3aed; padding-bottom: 20px; }
    .logo { width: 80px; height: 80px; margin: 0 auto 15px; }
    .store-name { color: #7c3aed; font-size: 24px; font-weight: bold; margin: 0; }
    .tagline { color: #666; font-size: 12px; }
    .section { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
    .row { display: flex; justify-content: space-between; margin: 8px 0; gap: 10px; }
    .label { color: #666; }
    .value { font-weight: bold; }
    .total { font-size: 20px; color: #7c3aed; }
    .status { background: #22c55e; color: white; padding: 4px 12px; border-radius: 20px; display: inline-block; }
    .items-section { margin: 20px 0; padding: 15px; background: #f0f0ff; border-radius: 8px; }
    .items-title { font-weight: bold; margin-bottom: 10px; color: #7c3aed; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px dashed #ccc; color: #666; font-size: 12px; }
    .payment-method { background: #e0f2fe; color: #0369a1; padding: 4px 12px; border-radius: 20px; display: inline-block; font-size: 12px; margin-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 5L90 25V75L50 95L10 75V25L50 5Z" fill="#7c3aed"/>
        <text x="50" y="60" font-size="40" fill="white" text-anchor="middle" font-weight="bold">P</text>
      </svg>
    </div>
    <h1 class="store-name">Patrichia's Store</h1>
    <p class="tagline">Quality School Uniforms</p>
  </div>
  
  <div class="section">
    <div class="row">
      <span class="label">Customer:</span>
      <span class="value">${orderDetails.customerName}</span>
    </div>
    <div class="row">
      <span class="label">Order ID:</span>
      <span class="value">${orderDetails.orderId.slice(0, 8)}</span>
    </div>
    <div class="row">
      <span class="label">Tracking:</span>
      <span class="value">${orderDetails.trackingCode || 'N/A'}</span>
    </div>
    <div class="row">
      <span class="label">Date:</span>
      <span class="value">${new Date().toLocaleDateString()}</span>
    </div>
    <div class="row">
      <span class="label">Payment:</span>
      <span class="payment-method">${paymentMethodLabel}</span>
    </div>
  </div>

  <div class="items-section">
    <p class="items-title">📦 Items Ordered</p>
    ${itemsHTML || '<p>No items</p>'}
  </div>
  
  <div class="section">
    <div class="row">
      <span class="label">Amount Paid:</span>
      <span class="value total">Ksh ${orderDetails.total.toLocaleString()}</span>
    </div>
    <div class="row">
      <span class="label">Status:</span>
      <span class="status">PAID ✓</span>
    </div>
  </div>
  
  <div class="footer">
    <p>Thank you for shopping with us! 🙏</p>
    <p>📍 Uhuru Market, Store F47</p>
    <p>📞 0726075180</p>
  </div>
</body>
</html>
    `;

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
    if (!orderDetails) return;
    if (!complaintText.trim()) {
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
    toast.success('Opening WhatsApp... Don\'t forget to attach your receipt!');
  };

  if (!orderDetails) {
    return (
      <Layout>
        <div className="container-shop py-8">
          <div className="max-w-2xl mx-auto text-center py-12">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No order found</h2>
            <p className="text-muted-foreground mb-6">
              Please start a new order from our shop.
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
          {/* Success Header */}
          <div className="text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${paymentVerified ? 'bg-green-100' : 'bg-primary/10'}`}>
              {paymentVerified ? (
                <Check className="h-8 w-8 text-green-600" />
              ) : (
                <CreditCard className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {paymentVerified ? 'Payment Confirmed!' : 'Complete Your Payment'}
              </h1>
              <p className="text-muted-foreground">
                {paymentVerified 
                  ? 'Thank you! Your order has been confirmed.' 
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
                  <p className="text-2xl font-bold text-primary">
                    Ksh {orderDetails.total.toLocaleString()}
                  </p>
                </div>
                <Badge 
                  variant={paymentVerified ? "default" : "secondary"} 
                  className={`flex items-center gap-1 ${paymentVerified ? 'bg-green-600' : ''}`}
                >
                  {paymentVerified ? (
                    <>
                      <Check className="h-3 w-3" />
                      Paid
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      Awaiting Payment
                    </>
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

          {/* Payment Options - Show when not verified */}
          {!paymentVerified && (
            <>
              {/* Payment Method Selector */}
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
                    {/* Pesapal Option */}
                    <label
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === 'pesapal'
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="pesapal" />
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">💳 Pesapal STK Push</p>
                        <p className="text-sm text-muted-foreground">
                          Fast & secure. Get instant M-Pesa prompt on your phone
                        </p>
                      </div>
                      <Badge className="bg-green-100 text-green-700 border-green-200">Recommended</Badge>
                    </label>

                    {/* M-Pesa Paybill Option */}
                    <label
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        paymentMethod === 'mpesa'
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <RadioGroupItem value="mpesa" />
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">🏦 M-Pesa Paybill</p>
                        <p className="text-sm text-muted-foreground">
                          Manual Paybill payment. Paste SMS to verify
                        </p>
                      </div>
                      <Badge variant="outline">Fallback</Badge>
                    </label>
                  </RadioGroup>

                  {/* Important Notice */}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold">Important:</p>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Pay the <strong>exact amount: Ksh {orderDetails.total.toLocaleString()}</strong></li>
                        <li>Underpayment or overpayment will be rejected</li>
                        <li>Duplicate M-Pesa codes are not accepted</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Pesapal Payment Flow */}
              {paymentMethod === 'pesapal' && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Wallet className="h-5 w-5" />
                      Pay with Pesapal
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border border-green-200">
                        <p className="text-sm text-muted-foreground mb-2">Amount to Pay:</p>
                        <p className="text-3xl font-bold text-green-600">
                          Ksh {orderDetails.total.toLocaleString()}
                        </p>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-green-800">How it works:</h4>
                        <ol className="space-y-2 text-sm">
                          {[
                            'Click "Pay Now with Pesapal" button below',
                            'Enter your M-Pesa phone number on Pesapal',
                            'Approve the STK push on your phone',
                            'Enter transaction code below to verify & get receipt',
                          ].map((step, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="w-5 h-5 rounded-full bg-green-600 text-white flex items-center justify-center flex-shrink-0 text-xs">
                                {i + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>

                      <Button
                        onClick={handlePesapalPayment}
                        className="w-full bg-green-600 hover:bg-green-700"
                        size="lg"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Pay Now with Pesapal
                      </Button>

                      {/* Transaction Code Input */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-green-800">
                          Enter your M-Pesa transaction code to verify payment:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SGJ7HKPQ2X"
                          value={pesapalCode}
                          onChange={(e) => setPesapalCode(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && pesapalCode.trim().length >= 8) {
                              confirmPesapalPayment();
                            }
                          }}
                          className="w-full p-3 border border-green-300 rounded-lg font-mono text-lg text-center uppercase focus:ring-2 focus:ring-green-500 focus:border-green-500"
                          maxLength={12}
                        />
                        <p className="text-xs text-muted-foreground text-center">
                          Find this code in your M-Pesa confirmation SMS (required for receipt)
                        </p>
                      </div>

                        <Button
                          onClick={() => confirmPesapalPayment()}
                          className="w-full bg-primary hover:bg-primary/90"
                          size="lg"
                          disabled={isVerifying || pesapalCode.trim().length < 8}
                        >
                          {isVerifying ? 'Verifying Payment...' : '✓ Verify Payment & Download Receipt'}
                        </Button>

                      {/* Fallback notice */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                        <p className="text-sm text-blue-800">
                          Having trouble? Use the <strong>M-Pesa Paybill</strong> option below as a fallback.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* M-Pesa Paybill Flow */}
              {paymentMethod === 'mpesa' && (
                <>
                  {/* Payment Details */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        M-Pesa Paybill Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="bg-muted rounded-lg p-6 space-y-6">
                        {/* Paybill Number */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Paybill Number</p>
                            <p className="text-3xl font-bold font-mono">{PAYBILL_NUMBER}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(PAYBILL_NUMBER, 'paybill')}
                            className="h-12 w-12"
                          >
                            {copiedPaybill ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <Copy className="h-5 w-5" />
                            )}
                          </Button>
                        </div>

                        <div className="border-t" />

                        {/* Account Number */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-muted-foreground">Account Number</p>
                            <p className="text-3xl font-bold font-mono">{ACCOUNT_NUMBER}</p>
                          </div>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => copyToClipboard(ACCOUNT_NUMBER, 'account')}
                            className="h-12 w-12"
                          >
                            {copiedAccount ? (
                              <Check className="h-5 w-5 text-green-600" />
                            ) : (
                              <Copy className="h-5 w-5" />
                            )}
                          </Button>
                        </div>

                        <div className="border-t" />

                        {/* Amount */}
                        <div>
                          <p className="text-sm text-muted-foreground">Exact Amount to Pay</p>
                          <p className="text-3xl font-bold text-primary font-mono">
                            Ksh {orderDetails.total.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Steps */}
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

                  {/* Paste M-Pesa Message */}
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
                          After paying, you'll receive an SMS from M-Pesa. Paste that message below to verify your payment and download your receipt.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          onClick={handlePasteMessage}
                          className="flex items-center gap-2"
                        >
                          <ClipboardPaste className="h-4 w-4" />
                          Paste Message
                        </Button>
                        <Textarea
                          placeholder="Paste your M-Pesa confirmation SMS here... e.g., 'XYZ123ABC Confirmed. Ksh1,000.00 sent to...'"
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

              {/* Switch Payment Method Hint */}
              <p className="text-center text-sm text-muted-foreground">
                ⚠️ Having trouble? Try the {paymentMethod === 'pesapal' ? 'M-Pesa Paybill' : 'Pesapal'} option instead.
              </p>
            </>
          )}

          {/* Payment Verified - Download Receipt */}
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

                <Button
                  onClick={generateReceipt}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Receipt
                </Button>

                <div className="pt-4 border-t border-green-200">
                  <p className="text-sm text-green-700 mb-3">
                    Have an issue? Download your receipt first, then send a complaint:
                  </p>
                  
                  {!showComplaintForm ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowComplaintForm(true)}
                      className="w-full border-green-600 text-green-700 hover:bg-green-100"
                    >
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
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowComplaintForm(false);
                            setComplaintText('');
                          }}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleSendComplaint}
                          disabled={!complaintText.trim()}
                          className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                          Send via WhatsApp
                        </Button>
                      </div>
                      <p className="text-xs text-green-600">
                        💡 Tip: Download your receipt above and attach it to WhatsApp for faster resolution.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contact Support */}
          <Card className="bg-muted border-none">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Need help?</p>
                <p className="text-sm text-muted-foreground">
                  Contact us on WhatsApp or call
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Track Order Button */}
          {orderDetails.trackingCode && (
            <Button variant="outline" asChild className="w-full">
              <Link to={`/track-order?code=${orderDetails.trackingCode}`}>
                Track Your Order
              </Link>
            </Button>
          )}

          <Button variant="ghost" asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
