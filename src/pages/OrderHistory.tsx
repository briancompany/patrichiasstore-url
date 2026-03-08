import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Phone, Search, Package, Loader2, Truck, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface OrderRecord {
  order_id: string;
  status: string;
  total_amount: number;
  created_at: string;
  delivery_type: string;
  tracking_code: string | null;
  item_count: number;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-800' },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800' },
  processing: { label: 'Processing', color: 'bg-indigo-100 text-indigo-800' },
  ready: { label: 'Ready', color: 'bg-cyan-100 text-cyan-800' },
  out_for_delivery: { label: 'Out for Delivery', color: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Delivered', color: 'bg-emerald-100 text-emerald-800' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800' },
  awaiting_payment: { label: 'Awaiting Payment', color: 'bg-orange-100 text-orange-800' },
  new_school_setup: { label: 'Setting Up', color: 'bg-amber-100 text-amber-800' },
};

export default function OrderHistory() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (phone.trim().length < 9) return;
    setLoading(true);
    setSearched(true);

    const { data, error } = await supabase.rpc('get_order_history_by_phone', {
      _phone: phone.trim(),
    });

    if (error) {
      console.error('Error fetching order history:', error);
      setOrders([]);
    } else {
      setOrders((data as OrderRecord[]) || []);
    }
    setLoading(false);
  };

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Order History</h1>
            <p className="text-muted-foreground">
              Enter your phone number to view all your past orders
            </p>
          </div>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 0712345678"
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Button onClick={handleSearch} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Search
            </Button>
          </div>

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}

          {!loading && searched && orders.length === 0 && (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No orders found for this phone number</p>
            </div>
          )}

          {orders.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{orders.length} order{orders.length !== 1 ? 's' : ''} found</p>
              {orders.map((order) => {
                const status = statusLabels[order.status] || { label: order.status, color: 'bg-muted text-foreground' };
                return (
                  <Card key={order.order_id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge className={status.color}>{status.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(order.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <p className="text-lg font-bold">Ksh {order.total_amount.toLocaleString()}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Package className="h-3 w-3" />
                              {order.item_count} item{Number(order.item_count) !== 1 ? 's' : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              {order.delivery_type === 'delivery' ? (
                                <><Truck className="h-3 w-3" /> Delivery</>
                              ) : (
                                <><Clock className="h-3 w-3" /> Pickup</>
                              )}
                            </span>
                          </div>
                        </div>
                        {order.tracking_code && (
                          <Button asChild variant="outline" size="sm">
                            <Link to={`/track-order?code=${order.tracking_code}`}>
                              Track
                            </Link>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
