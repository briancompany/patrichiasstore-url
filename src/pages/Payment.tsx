import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, Clock, Phone, CreditCard, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

interface LocationState {
  orderId: string;
  trackingCode: string | null;
  total: number;
  customerName: string;
}

export default function Payment() {
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [copiedPaybill, setCopiedPaybill] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  const PAYBILL_NUMBER = '247247';
  const ACCOUNT_NUMBER = '0726075180';

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

  if (!state) {
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
            <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Order Placed Successfully!</h1>
              <p className="text-muted-foreground">
                Hi {state.customerName}, please complete payment to confirm your order
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
                    Ksh {state.total.toLocaleString()}
                  </p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Awaiting Payment
                </Badge>
              </div>
              {state.trackingCode && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-sm text-muted-foreground">Order Tracking Code:</p>
                  <p className="font-mono font-bold text-lg">{state.trackingCode}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Details
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

                {/* Divider */}
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

                {/* Divider */}
                <div className="border-t" />

                {/* Amount */}
                <div>
                  <p className="text-sm text-muted-foreground">Amount to Pay</p>
                  <p className="text-3xl font-bold text-primary font-mono">
                    Ksh {state.total.toLocaleString()}
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
                    `Enter Amount: Ksh ${state.total.toLocaleString()}`,
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

          {/* What Happens Next */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                What Happens Next?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">1</span>
                </div>
                <div>
                  <p className="font-medium">Complete your M-Pesa payment</p>
                  <p className="text-sm text-muted-foreground">
                    Use the details above to make your payment
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">2</span>
                </div>
                <div>
                  <p className="font-medium">We verify your payment</p>
                  <p className="text-sm text-muted-foreground">
                    Our team will confirm your payment (usually within 1 hour)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-primary">3</span>
                </div>
                <div>
                  <p className="font-medium">Receive your receipt</p>
                  <p className="text-sm text-muted-foreground">
                    Once confirmed, you'll get a receipt via SMS/WhatsApp
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

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
                <a href="https://wa.me/254726075180" target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>

          {/* Track Order Button */}
          {state.trackingCode && (
            <Button variant="outline" asChild className="w-full">
              <Link to={`/track-order?code=${state.trackingCode}`}>
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
