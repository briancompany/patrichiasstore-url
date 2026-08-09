import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Search, Package, Clock, CheckCircle, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { downloadReceiptPDF } from '@/lib/receipt-pdf';

interface PublicTrackedOrder {
  order_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_type: string;
  item_count: number;
}

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get('code') || '';

  const [trackingCode, setTrackingCode] = useState(initialCode);
  const [isLoading, setIsLoading] = useState(false);
  const [order, setOrder] = useState<PublicTrackedOrder | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialCode) {
      handleSearch(initialCode);
    }
  }, []);

  const handleSearch = async (code?: string) => {
    const searchCode = (code || trackingCode).trim().toUpperCase();

    if (!searchCode) {
      toast.error('Please enter a tracking code');
      return;
    }

    const isUuid = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(searchCode);
    const isCode = /^(PS-)?[A-Z0-9]{4,16}$/.test(searchCode);

    if (!isUuid && !isCode) {
      toast.error('Enter a tracking code (PS-ABC123) or your full Order ID');
      return;
    }

    setIsLoading(true);
    setNotFound(false);
    setOrder(null);

    try {
      const { data, error } = await supabase.rpc('get_order_tracking_public', {
        _tracking_code: searchCode,
      });

      if (error) throw error;

      const tracked = data?.[0];
      if (!tracked) {
        setNotFound(true);
        return;
      }

      setOrder({
        order_id: tracked.order_id,
        status: tracked.status,
        total_amount: tracked.total_amount,
        created_at: tracked.created_at,
        delivery_type: tracked.delivery_type,
        item_count: Number(tracked.item_count || 0),
      });
    } catch {
      toast.error('Unable to fetch order status. Please try again.');
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
          label: 'Order Received',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Package,
          description: 'Your order has been received',
        };
      case 'confirmed':
        return {
          label: 'Payment Confirmed',
          color: 'bg-green-100 text-green-800 border-green-300',
          icon: CheckCircle,
          description: 'Payment confirmed – preparing your order',
        };
      case 'processing':
        return {
          label: 'Processing',
          color: 'bg-indigo-100 text-indigo-800 border-indigo-300',
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
      case 'out_for_delivery':
        return {
          label: 'Out for Delivery',
          color: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          icon: Package,
          description: 'Your order is on the way!',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: CheckCircle,
          description: 'Your order has been delivered',
        };
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

  const downloadReceipt = async () => {
    if (!order || (order.status !== 'confirmed' && order.status !== 'completed')) {
      toast.error('Receipt is only available after payment confirmation');
      return;
    }

    try {
      await downloadReceiptPDF({
        order_id: order.order_id,
        tracking_code: trackingCode.trim().toUpperCase(),
        customer_name: 'Valued Customer',
        date: order.created_at,
        status: order.status === 'completed' ? 'COMPLETED' : 'PAID',
        delivery_type: order.delivery_type,
        total: order.total_amount,
        item_count: Number(order.item_count),
      });
      toast.success('Receipt downloaded');
    } catch {
      toast.error('Could not generate receipt. Please try again.');
    }
  };

  const statusInfo = order ? getStatusInfo(order.status) : null;
  const StatusIcon = statusInfo?.icon || Package;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Track Your Order</h1>
            <p className="text-muted-foreground">
              Enter your tracking code or Order ID — orders never expire, old ones included
            </p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2">
                <Input
                  placeholder="Tracking code (PS-ABC123) or Order ID"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={() => handleSearch()} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Lost your code?{' '}
                <Link to="/order-history" className="text-primary underline">
                  Find all your orders by phone number
                </Link>
              </p>
            </CardContent>
          </Card>

          {notFound && (
            <Card className="border-destructive/50">
              <CardContent className="py-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Order Not Found</h3>
                <p className="text-sm text-muted-foreground">
                  Double-check the code, or{' '}
                  <Link to="/order-history" className="text-primary underline">
                    search all your orders by phone number
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          )}

          {order && statusInfo && (
            <>
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${statusInfo.color}`}>
                      <StatusIcon className="h-8 w-8" />
                    </div>
                    <div className="flex-1">
                      <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                      <p className="text-muted-foreground mt-1">{statusInfo.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Order ID</p>
                      <p className="font-medium break-all">{order.order_id}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Order Date</p>
                      <p className="font-medium">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Delivery Type</p>
                      <p className="font-medium">{order.delivery_type === 'pickup' ? 'Store Pickup' : 'Delivery'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Items</p>
                      <p className="font-medium">{order.item_count}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4 flex justify-between items-center">
                    <span className="font-semibold text-lg">Total:</span>
                    <span className="text-2xl font-bold text-primary">Ksh {order.total_amount.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {(order.status === 'confirmed' || order.status === 'delivered' || order.status === 'completed') && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">Payment Confirmed!</p>
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
