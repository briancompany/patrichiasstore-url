import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check, Clock, Phone, CreditCard, ShoppingBag, ClipboardPaste, Download, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LocationState {
  orderId: string;
  trackingCode: string | null;
  total: number;
  customerName: string;
  customerPhone?: string;
}

// Parse M-Pesa confirmation message
const parseMpesaMessage = (message: string) => {
  // Pattern: "XYZ123ABC Confirmed. Ksh1,000.00 sent to..."
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
  const state = location.state as LocationState | null;

  const [copiedPaybill, setCopiedPaybill] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [mpesaMessage, setMpesaMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [orderDetails, setOrderDetails] = useState<LocationState | null>(null);

  const PAYBILL_NUMBER = '247247';
  const ACCOUNT_NUMBER = '0726075180';
  const WHATSAPP_NUMBER = '254726075180';

  useEffect(() => {
    if (state) {
      setOrderDetails(state);
    }
  }, [state]);

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

    const parsed = parseMpesaMessage(mpesaMessage);

    // Validate the message
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

    if (parsed.amount < orderDetails.total) {
      toast.error(`Amount Ksh ${parsed.amount.toLocaleString()} is less than required Ksh ${orderDetails.total.toLocaleString()}`);
      setIsVerifying(false);
      return;
    }

    if (!parsed.confirmCode) {
      toast.error('Could not detect M-Pesa confirmation code');
      setIsVerifying(false);
      return;
    }

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          notes: `M-Pesa Code: ${parsed.confirmCode}`
        })
        .eq('id', orderDetails.orderId);

      if (orderError) throw orderError;

      // Record payment for admin
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: orderDetails.orderId,
          amount: parsed.amount,
          mpesa_code: parsed.confirmCode,
          customer_name: orderDetails.customerName,
          customer_phone: orderDetails.customerPhone || null,
        });

      if (paymentError) {
        console.error('Payment record error:', paymentError);
        // Don't fail the verification if payment record fails
      }

      setPaymentVerified(true);
      toast.success('Payment verified successfully! Download your receipt below.');
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to verify payment. Please contact support.');
    } finally {
      setIsVerifying(false);
    }
  };

  const generateReceipt = () => {
    if (!orderDetails) return;

    const receiptContent = `
╔══════════════════════════════════════════╗
║         PATRICHIA'S STORE                ║
║           OFFICIAL RECEIPT               ║
╠══════════════════════════════════════════╣
║ Customer: ${orderDetails.customerName.padEnd(28)}║
║ Order ID: ${orderDetails.orderId.slice(0, 8).padEnd(28)}║
║ Tracking: ${(orderDetails.trackingCode || 'N/A').padEnd(28)}║
║ Amount: Ksh ${orderDetails.total.toLocaleString().padEnd(25)}║
║ Status: PAID                             ║
║ Date: ${new Date().toLocaleDateString().padEnd(30)}║
╠══════════════════════════════════════════╣
║ Thank you for shopping with us!          ║
║ Contact: 0726075180                      ║
╚══════════════════════════════════════════╝
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${orderDetails.trackingCode || orderDetails.orderId.slice(0, 8)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded!');
  };

  const handleSendComplaint = () => {
    if (!orderDetails) return;

    const message = encodeURIComponent(
      `Hello Patrichia's Store!\n\n` +
      `I have a complaint regarding my order:\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 Name: ${orderDetails.customerName}\n` +
      `🔖 Tracking: ${orderDetails.trackingCode || 'N/A'}\n` +
      `💰 Amount: Ksh ${orderDetails.total.toLocaleString()}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `My complaint:\n[Please describe your issue here]\n\n` +
      `I have attached my receipt for reference.`
    );

    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
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
                  : `Hi ${orderDetails.customerName}, pay via M-Pesa and paste the confirmation message.`}
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

          {/* M-Pesa Payment Flow - Show when not verified */}
          {!paymentVerified && (
            <>
              {/* Payment Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5" />
                    M-Pesa Payment Details
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
                      <p className="text-sm text-muted-foreground">Amount to Pay</p>
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
                        `Enter Amount: Ksh ${orderDetails.total.toLocaleString()}`,
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
                      After paying, you'll receive an SMS from M-Pesa. Paste that message below to instantly verify your payment and download your receipt.
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
                    className="w-full"
                    size="lg"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Payment'}
                  </Button>
                </CardContent>
              </Card>
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
                    Have an issue? Send your complaint with the receipt:
                  </p>
                  <Button
                    variant="outline"
                    onClick={handleSendComplaint}
                    className="w-full border-green-600 text-green-700 hover:bg-green-100"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Send Complaint via WhatsApp
                  </Button>
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
