import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Clock, CheckCircle, Printer, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_name: string;
  school_name: string | null;
  size: string;
  quantity: number;
  price_at_purchase: number;
  printing_required: boolean;
}

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_school: string | null;
  delivery_type: string;
  delivery_location: string | null;
  status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
}

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
  }, []);

  const handleSearch = async (code?: string) => {
    const searchCode = code || trackingCode;
    if (!searchCode.trim()) {
      toast.error('Please enter a tracking code');
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setOrder(null);

    try {
      // First find the order_id from tracking table
      const { data: trackingData, error: trackingError } = await supabase
        .from('order_tracking')
        .select('order_id')
        .eq('tracking_code', searchCode.trim().toUpperCase())
        .maybeSingle();

      if (trackingError) throw trackingError;

      if (!trackingData) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      // Fetch the order with items
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', trackingData.order_id)
        .single();

      if (orderError) throw orderError;

      setOrder(orderData);
    } catch (error) {
      console.error('Error fetching order:', error);
      setNotFound(true);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return {
          label: 'Awaiting Payment',
          color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
          icon: Clock,
          description: 'Please complete your M-Pesa payment',
        };
      case 'pending':
        return {
          label: 'Payment Received',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Package,
          description: 'Your order is being prepared',
        };
      case 'ready':
        return {
          label: 'Ready',
          color: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: Package,
          description: 'Your order is ready for pickup/delivery',
        };
      case 'confirmed':
      case 'completed':
        return {
          label: 'Completed',
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: CheckCircle,
          description: 'Order completed successfully',
        };
      default:
        return {
          label: status,
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          icon: Clock,
          description: '',
        };
    }
  };

  const downloadReceipt = () => {
    if (!order || order.status !== 'confirmed' && order.status !== 'completed') {
      toast.error('Receipt is only available after payment confirmation');
      return;
    }

    const receiptContent = `
      <html>
        <head>
          <title>Receipt - Patrichia's Store</title>
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              padding: 40px; 
              max-width: 600px; 
              margin: 0 auto; 
              color: #333;
            }
            .header { 
              text-align: center; 
              border-bottom: 2px solid #333; 
              padding-bottom: 20px; 
              margin-bottom: 30px; 
            }
            .header h1 { margin: 0; font-size: 28px; }
            .header p { margin: 5px 0; color: #666; }
            .section { margin-bottom: 25px; }
            .section-title { 
              font-weight: bold; 
              font-size: 14px; 
              text-transform: uppercase; 
              color: #666; 
              margin-bottom: 10px; 
            }
            .row { 
              display: flex; 
              justify-content: space-between; 
              padding: 8px 0; 
              border-bottom: 1px solid #eee; 
            }
            .item-row { 
              padding: 12px 0; 
              border-bottom: 1px solid #eee; 
            }
            .item-name { font-weight: 600; }
            .item-details { color: #666; font-size: 14px; }
            .total-section { 
              background: #f5f5f5; 
              padding: 20px; 
              border-radius: 8px; 
              margin-top: 20px; 
            }
            .total-row { 
              display: flex; 
              justify-content: space-between; 
              font-size: 20px; 
              font-weight: bold; 
            }
            .footer { 
              text-align: center; 
              margin-top: 40px; 
              padding-top: 20px; 
              border-top: 1px solid #eee; 
              color: #666; 
            }
            .thank-you { 
              font-size: 18px; 
              color: #333; 
              margin-bottom: 10px; 
            }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Patrichia's Store</h1>
            <p>Official Receipt</p>
            <p>Store F47, Uhuru Market</p>
          </div>
          
          <div class="section">
            <div class="section-title">Order Details</div>
            <div class="row"><span>Order ID:</span><span>${order.id.slice(0, 8).toUpperCase()}</span></div>
            <div class="row"><span>Date:</span><span>${new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
            <div class="row"><span>Status:</span><span>✓ Payment Confirmed</span></div>
          </div>
          
          <div class="section">
            <div class="section-title">Customer</div>
            <div class="row"><span>Name:</span><span>${order.customer_name}</span></div>
            <div class="row"><span>Phone:</span><span>${order.customer_phone}</span></div>
            ${order.customer_school ? `<div class="row"><span>School:</span><span>${order.customer_school}</span></div>` : ''}
            <div class="row"><span>Delivery:</span><span>${order.delivery_type === 'pickup' ? 'Store Pickup' : order.delivery_location}</span></div>
          </div>
          
          <div class="section">
            <div class="section-title">Items</div>
            ${order.order_items.map(item => `
              <div class="item-row">
                <div class="item-name">${item.product_name}</div>
                <div class="item-details">Size: ${item.size} • Qty: ${item.quantity}${item.printing_required ? ' • Logo Printing' : ''}</div>
                <div style="text-align: right; font-weight: 600;">Ksh ${item.price_at_purchase.toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
          
          <div class="total-section">
            <div class="total-row">
              <span>Total Paid</span>
              <span>Ksh ${order.total_amount.toLocaleString()}</span>
            </div>
          </div>
          
          <div class="footer">
            <p class="thank-you">Thank you for shopping with us! 🙏</p>
            <p>For any inquiries, contact us on WhatsApp: +254 726 075 180</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(receiptContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const statusInfo = order ? getStatusInfo(order.status) : null;
  const StatusIcon = statusInfo?.icon || Clock;

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Track Your Order</h1>
            <p className="text-muted-foreground">
              Enter your tracking code to check your order status
            </p>
          </div>

          {/* Search Form */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    placeholder="Enter tracking code (e.g., PS-ABC123)"
                    className="pl-10 uppercase"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <Button onClick={() => handleSearch()} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Track'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Not Found */}
          {notFound && (
            <Card className="border-destructive/50">
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Order Not Found</h3>
                <p className="text-muted-foreground mb-4">
                  We couldn't find an order with that tracking code. Please check the code and try
                  again.
                </p>
                <Button variant="outline" asChild>
                  <Link to="/uniform-shop">Continue Shopping</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Order Details */}
          {order && statusInfo && (
            <>
              {/* Status Card */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center ${statusInfo.color}`}
                    >
                      <StatusIcon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      <p className="text-muted-foreground mt-1">{statusInfo.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Order Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Customer</p>
                      <p className="font-medium">{order.customer_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{order.customer_phone}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">School</p>
                      <p className="font-medium">{order.customer_school || '-'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Order Date</p>
                      <p className="font-medium">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-3">Items</p>
                    <div className="space-y-3">
                      {order.order_items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center p-3 bg-muted rounded-lg"
                        >
                          <div>
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-sm text-muted-foreground">
                              Size: {item.size} × {item.quantity}
                              {item.printing_required && (
                                <Badge variant="secondary" className="ml-2">
                                  <Printer className="h-3 w-3 mr-1" />
                                  Logo
                                </Badge>
                              )}
                            </p>
                          </div>
                          <p className="font-medium">
                            Ksh {item.price_at_purchase.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="font-semibold text-lg">Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      Ksh {order.total_amount.toLocaleString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Receipt Download (only for confirmed orders) */}
              {(order.status === 'confirmed' || order.status === 'completed') && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">Payment Confirmed!</p>
                      <p className="text-sm text-green-700">
                        Your receipt is ready to download
                      </p>
                    </div>
                    <Button onClick={downloadReceipt} className="bg-green-600 hover:bg-green-700">
                      <Download className="h-4 w-4 mr-2" />
                      Receipt
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <Button variant="ghost" asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </div>
      </div>
    </Layout>
  );
}
