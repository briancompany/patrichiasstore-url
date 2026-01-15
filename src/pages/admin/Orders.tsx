import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye, Phone, MapPin, Calendar, ClipboardList, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface OrderItem {
  id: string;
  product_name: string;
  school_name: string | null;
  size: string;
  quantity: number;
  price_at_purchase: number;
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
  notes: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching orders');
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setIsLoading(false);
  };

  const updateOrderStatus = async (orderId: string, status: 'pending' | 'ready' | 'completed' | 'confirmed') => {
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);

    if (error) {
      toast.error('Error updating order');
    } else {
      const statusMessages: Record<string, string> = {
        pending: 'Payment verified - order is pending',
        ready: 'Order is ready',
        completed: 'Order completed',
        confirmed: 'Payment confirmed',
      };
      toast.success(statusMessages[status] || `Order marked as ${status}`);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ready':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed':
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'awaiting_payment':
        return 'Awaiting Payment';
      case 'pending':
        return 'Pending';
      case 'ready':
        return 'Ready';
      case 'confirmed':
        return 'Confirmed';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const printReceipt = (order: Order) => {
    const printContent = `
      <html>
        <head>
          <title>Order Receipt - ${order.id.slice(0, 8)}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
            h1 { font-size: 18px; text-align: center; margin-bottom: 5px; }
            h2 { font-size: 14px; text-align: center; margin-top: 0; color: #666; }
            .divider { border-top: 1px dashed #ccc; margin: 15px 0; }
            .row { display: flex; justify-content: space-between; margin: 5px 0; }
            .items { margin: 15px 0; }
            .item { margin: 10px 0; padding-bottom: 10px; border-bottom: 1px solid #eee; }
            .total { font-weight: bold; font-size: 16px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Patrichia's Store</h1>
          <h2>Uhuru Market, Store F47</h2>
          <div class="divider"></div>
          <div class="row"><span>Order ID:</span><span>${order.id.slice(0, 8).toUpperCase()}</span></div>
          <div class="row"><span>Date:</span><span>${new Date(order.created_at).toLocaleDateString()}</span></div>
          <div class="row"><span>Customer:</span><span>${order.customer_name}</span></div>
          <div class="row"><span>Phone:</span><span>${order.customer_phone}</span></div>
          ${order.delivery_type === 'delivery' ? `<div class="row"><span>Delivery:</span><span>${order.delivery_location}</span></div>` : '<div class="row"><span>Pickup:</span><span>Store F47</span></div>'}
          <div class="divider"></div>
          <div class="items">
            ${order.order_items?.map((item) => `
              <div class="item">
                <div class="row"><strong>${item.product_name}</strong></div>
                <div class="row"><span>Size: ${item.size} × ${item.quantity}</span><span>Ksh ${item.price_at_purchase.toLocaleString()}</span></div>
              </div>
            `).join('') || ''}
          </div>
          <div class="divider"></div>
          <div class="row total"><span>TOTAL:</span><span>Ksh ${order.total_amount.toLocaleString()}</span></div>
          <div class="footer">
            <p>Thank you for shopping with us!</p>
            <p>+254 700 000 000</p>
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground">Manage customer orders</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No orders found</h3>
              <p className="text-muted-foreground">
                {searchQuery || filterStatus !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Orders will appear here when customers place them'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <Card key={order.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg">{order.customer_name}</h3>
                        <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {order.customer_phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {order.delivery_type === 'pickup'
                            ? 'Store Pickup'
                            : order.delivery_location}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(order.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="font-semibold text-primary">
                        Total: Ksh {order.total_amount.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                          <DialogHeader>
                            <DialogTitle>Order Details</DialogTitle>
                          </DialogHeader>
                          {selectedOrder && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Customer</p>
                                  <p className="font-medium">{selectedOrder.customer_name}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Phone</p>
                                  <p className="font-medium">{selectedOrder.customer_phone}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">School</p>
                                  <p className="font-medium">
                                    {selectedOrder.customer_school || '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Delivery</p>
                                  <p className="font-medium capitalize">
                                    {selectedOrder.delivery_type}
                                  </p>
                                </div>
                              </div>

                              {selectedOrder.delivery_location && (
                                <div>
                                  <p className="text-sm text-muted-foreground">Delivery Location</p>
                                  <p className="font-medium">{selectedOrder.delivery_location}</p>
                                </div>
                              )}

                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Items</p>
                                <div className="space-y-2">
                                  {selectedOrder.order_items?.map((item) => (
                                    <div
                                      key={item.id}
                                      className="flex justify-between p-2 bg-muted rounded"
                                    >
                                      <div>
                                        <p className="font-medium">{item.product_name}</p>
                                        <p className="text-sm text-muted-foreground">
                                          Size: {item.size} × {item.quantity}
                                        </p>
                                      </div>
                                      <p className="font-medium">
                                        Ksh {item.price_at_purchase.toLocaleString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                                <span className="font-semibold">Total</span>
                                <span className="text-xl font-bold text-primary">
                                  Ksh {selectedOrder.total_amount.toLocaleString()}
                                </span>
                              </div>

                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => printReceipt(selectedOrder)}
                                >
                                  <Printer className="h-4 w-4 mr-1" />
                                  Print Receipt
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printReceipt(order)}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>

                      {order.status === 'awaiting_payment' && (
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => updateOrderStatus(order.id, 'confirmed')}
                        >
                          Confirm Payment
                        </Button>
                      )}
                      {order.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {order.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button size="sm" onClick={() => updateOrderStatus(order.id, 'completed')}>
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
