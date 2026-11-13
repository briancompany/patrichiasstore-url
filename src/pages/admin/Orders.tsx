import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Search, Eye, Phone, MapPin, Calendar, ClipboardList, Printer, School, AlertTriangle, Plus, Image as ImageIcon, Palette, ExternalLink, Truck, CalendarDays, MessageCircle, Mail, CheckCircle2, BellRing } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { printReceiptPDF } from '@/lib/receipt-pdf';

interface OrderItem {
  id: string;
  product_name: string;
  school_name: string | null;
  size: string;
  quantity: number;
  price_at_purchase: number;
  printing_required: boolean;
  logo_url: string | null;
  color: string | null;
  sample_image_url: string | null;
}

interface ChatSpecialOrderLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  school: string | null;
  interest: string | null;
  created_at: string;
  is_handled: boolean;
}

const toWhatsAppNumber = (phone: string) => {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) return `254${digits.slice(1)}`;
  if (digits.startsWith('254')) return digits;
  return digits;
};

const getDeliveryMapUrl = (location: string | null) => {
  if (!location) return null;
  const match = location.match(/https?:\/\/[^\s]+/i);
  if (match) return match[0].replace(/[),.]+$/, '');
  const coordinates = location.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (coordinates) return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
};

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_school: string | null;
  delivery_type: string;
  delivery_location: string | null;
  status: string;
  total_amount: number;
  payment_method: 'pesapal' | 'mpesa' | 'cash' | null;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_reference: string | null;
  notes: string | null;
  created_at: string;
  is_new_school: boolean;
  is_special_order?: boolean;
  special_order_note?: string | null;
  linked_school_id: string | null;
  scheduled_delivery_date: string | null;
  order_items?: OrderItem[];
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [chatSpecialOrders, setChatSpecialOrders] = useState<ChatSpecialOrderLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState<'month' | 'all'>('month');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [schoolProfileOrder, setSchoolProfileOrder] = useState<Order | null>(null);
  const [schoolProfileName, setSchoolProfileName] = useState('');
  const [isCreatingSchoolProfile, setIsCreatingSchoolProfile] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchChatSpecialOrders();
    const channel = supabase
      .channel('admin-orders-and-special-order-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        void fetchOrders();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_leads' }, () => {
        void fetchChatSpecialOrders();
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [filterPeriod]);

  const fetchOrders = async () => {
    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (filterPeriod === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      // Always include special orders, even when they were placed before this month.
      query = query.or(`created_at.gte.${startOfMonth.toISOString()},is_special_order.eq.true`);
    }

    const { data, error } = await query;

    if (error) {
      toast.error('Error fetching orders');
      console.error(error);
    } else {
      setOrders(data || []);
    }
    setIsLoading(false);
  };

  const fetchChatSpecialOrders = async () => {
    const { data, error } = await supabase
      .from('chat_leads')
      .select('id, name, phone, email, school, interest, created_at, is_handled')
      .eq('lead_type', 'special_order')
      .eq('is_handled', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Could not load chatbot special orders:', error);
      return;
    }
    setChatSpecialOrders(data || []);
  };

  const markChatSpecialOrderAttended = async (leadId: string) => {
    const { error } = await supabase
      .from('chat_leads')
      .update({ is_handled: true })
      .eq('id', leadId);
    if (error) {
      toast.error('Could not update special-order request');
      return;
    }
    setChatSpecialOrders((current) => current.filter((lead) => lead.id !== leadId));
    toast.success('Chatbot special-order request marked as attended');
  };

  const sendDeliveryEmail = async (orderId: string, payload: { scheduledDate?: string; statusUpdate?: string }) => {
    const { error } = await supabase.functions.invoke('send-delivery-update', {
      body: { orderId, ...payload },
    });
    if (error) {
      console.error('Customer delivery email failed:', error);
      toast.error('Order updated, but the customer email could not be sent');
      return false;
    }
    return true;
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from('orders').update({ status: status as any }).eq('id', orderId);

    if (error) {
      toast.error('Error updating order');
    } else {
      const statusMessages: Record<string, string> = {
        pending: 'Payment verified - order is pending',
        ready: 'Order is ready',
        completed: 'Order completed',
        confirmed: 'Payment confirmed',
        awaiting_payment: 'Order updated to awaiting payment',
        processing: 'Order is being processed',
        out_for_delivery: 'Order is out for delivery',
        delivered: 'Order delivered successfully',
      };
      toast.success(statusMessages[status] || `Order marked as ${status}`);
      setOrders(orders.map((o) => (o.id === orderId ? { ...o, status } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status });
      }

      // Email the customer on every status change so they always know where
      // their order stands.
      sendDeliveryEmail(orderId, { statusUpdate: status });
    }
  };

  const markOrderPaid = async (order: Order) => {
    const reference = window.prompt('Payment reference (optional). For cash, leave blank:');
    if (reference === null) return;
    const { error } = await supabase.rpc('admin_mark_order_paid', {
      _order_id: order.id,
      _reference: reference.trim() || null,
    });
    if (error) {
      toast.error(error.message || 'Could not record payment');
      return;
    }
    const updated = { ...order, payment_status: 'paid' as const, payment_reference: reference.trim() || null };
    setOrders((current) => current.map((item) => item.id === order.id ? updated : item));
    if (selectedOrder?.id === order.id) setSelectedOrder(updated);
    toast.success('Payment recorded. Order fulfilment status was not changed.');
  };

  const scheduleDelivery = async (orderId: string, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const previousDate = orders.find((order) => order.id === orderId)?.scheduled_delivery_date || null;
    if (previousDate === dateStr) {
      toast.info('That delivery date is already scheduled');
      return;
    }
    const { error } = await supabase
      .from('orders')
      .update({ scheduled_delivery_date: dateStr } as any)
      .eq('id', orderId);

    if (error) {
      toast.error('Error scheduling delivery');
    } else {
      setOrders((current) => current.map((o) => (o.id === orderId ? { ...o, scheduled_delivery_date: dateStr } : o)));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, scheduled_delivery_date: dateStr });
      }
      const sent = await sendDeliveryEmail(orderId, { scheduledDate: dateStr });
      toast.success(sent
        ? previousDate ? 'Delivery rescheduled and customer notified by email' : 'Delivery scheduled and customer notified by email'
        : 'Delivery date saved; customer email needs attention');
    }
  };

  const handleCreateSchoolProfile = (order: Order) => {
    setSchoolProfileOrder(order);
    setSchoolProfileName(order.customer_school?.trim() || '');
  };

  const saveSchoolProfileForOrder = async () => {
    if (!schoolProfileOrder || !schoolProfileName.trim()) {
      toast.error('Enter the school name first');
      return;
    }
    setIsCreatingSchoolProfile(true);
    try {
      const normalizedName = schoolProfileName.trim().replace(/\\s+/g, ' ');
      const { data: existing, error: lookupError } = await supabase
        .from('schools')
        .select('id, name, logo_url')
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle();
      if (lookupError) throw lookupError;

      let schoolId = existing?.id;
      if (!schoolId) {
        const { data: created, error: createError } = await supabase
          .from('schools')
          .insert({ name: normalizedName })
          .select('id')
          .single();
        if (createError) throw createError;
        schoolId = created.id;
      }

      const nextStatus = schoolProfileOrder.is_special_order ? 'processing' : 'ready';
      const { error: linkError } = await supabase
        .from('orders')
        .update({ linked_school_id: schoolId, customer_school: normalizedName, is_new_school: false, status: nextStatus })
        .eq('id', schoolProfileOrder.id);
      if (linkError) throw linkError;

      const { error: itemError } = await supabase
        .from('order_items')
        .update({ school_name: normalizedName })
        .eq('order_id', schoolProfileOrder.id);
      if (itemError) console.warn('School profile linked, but order item labels could not be updated:', itemError);

      const updatedOrder = { ...schoolProfileOrder, linked_school_id: schoolId, customer_school: normalizedName, is_new_school: false, status: nextStatus };
      setOrders((current) => current.map((order) => order.id === updatedOrder.id ? { ...order, ...updatedOrder } : order));
      if (selectedOrder?.id === updatedOrder.id) setSelectedOrder({ ...selectedOrder, ...updatedOrder });
      await sendDeliveryEmail(updatedOrder.id, { statusUpdate: nextStatus });
      toast.success(`School profile created and order moved to ${nextStatus === 'processing' ? 'Processing' : 'Ready'}`);
      setSchoolProfileOrder(null);
    } catch (error) {
      console.error('Could not create school profile from order:', error);
      toast.error(error instanceof Error ? error.message : 'Could not create school profile');
    } finally {
      setIsCreatingSchoolProfile(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.customer_phone.includes(searchQuery) ||
      (order.customer_school?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchesSearch && matchesStatus;
  })
    // Special (stock-short) orders are fast-forwarded to the top.
    .sort((a, b) => Number(Boolean(b.is_special_order)) - Number(Boolean(a.is_special_order)));

  // Count new school orders
  const newSchoolOrdersCount = orders.filter(o => o.is_new_school && o.status === 'new_school_setup').length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new_school_setup':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'awaiting_payment':
      case 'pending_payment':
      case 'payment_initiated':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'declined':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'ready':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'processing':
        return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'out_for_delivery':
        return 'bg-cyan-100 text-cyan-800 border-cyan-300';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'new_school_setup':
        return 'New School – Setup Required';
      case 'awaiting_payment':
        return 'Awaiting Payment';
      case 'pending_payment':
        return 'Waiting for Payment';
      case 'payment_initiated':
        return 'Payment Started';
      case 'declined':
        return 'Declined';
      case 'pending':
        return 'Pending';
      case 'ready':
        return 'Ready';
      case 'confirmed':
        return 'Confirmed';
      case 'processing':
        return 'Processing';
      case 'out_for_delivery':
        return 'Out for Delivery';
      case 'delivered':
        return 'Delivered';
      case 'completed':
        return 'Completed';
      default:
        return status;
    }
  };

  const printReceipt = async (order: Order) => {
    try {
      await printReceiptPDF({
        order_id: order.id,
        customer_name: order.customer_name,
        customer_phone: order.customer_phone,
        customer_school: order.customer_school,
        date: order.created_at,
        status: order.status === 'completed' ? 'COMPLETED' : order.status === 'confirmed' ? 'PAID' : order.status.toUpperCase(),
        delivery_type: order.delivery_type,
        delivery_location: order.delivery_location,
        total: order.total_amount,
        note: order.is_new_school ? 'New school — uniform setup required before fulfilment.' : null,
        items: (order.order_items || []).map((it) => ({
          product_name: it.product_name,
          size: it.size,
          color: it.color,
          quantity: it.quantity,
          price: it.price_at_purchase,
          printing_required: it.printing_required,
        })),
      });
    } catch {
      toast.error('Could not generate receipt');
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

        {/* New School Orders Alert */}
        {newSchoolOrdersCount > 0 && (
          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-amber-800">
                    {newSchoolOrdersCount} New School {newSchoolOrdersCount === 1 ? 'Order' : 'Orders'} Pending Setup
                  </p>
                  <p className="text-sm text-amber-700">
                    These orders require school profile creation before processing
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100"
                onClick={() => setFilterStatus('new_school_setup')}
              >
                View All
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Chatbot requests awaiting checkout; converted requests appear as normal flagged orders below. */}
        {chatSpecialOrders.length > 0 && (
          <Card className="border-2 border-destructive/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-destructive">
                <BellRing className="h-5 w-5" />
                Pending Chatbot Special-Order Requests
                <Badge variant="destructive">{chatSpecialOrders.length} needs attention</Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                These requests are waiting for checkout. Once a customer continues to payment, the request is converted into a priority special order in the orders list.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {chatSpecialOrders.map((lead) => (
                <div key={lead.id} className="rounded-lg border bg-card p-3 space-y-3">
                  <div>
                    <p className="font-semibold">{lead.name || 'Customer name not provided'}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.school ? `${lead.school} · ` : ''}{new Date(lead.created_at).toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm whitespace-pre-wrap">{lead.interest}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {lead.phone && (
                      <>
                        <Button size="sm" asChild>
                          <a href={`tel:${lead.phone}`}><Phone className="h-4 w-4 mr-1" />Call</a>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <a href={`https://wa.me/${toWhatsAppNumber(lead.phone)}?text=${encodeURIComponent('Hello, this is Patrichia Store following up on your special-order request.')}`} target="_blank" rel="noreferrer">
                            <MessageCircle className="h-4 w-4 mr-1" />WhatsApp
                          </a>
                        </Button>
                      </>
                    )}
                    {lead.email && (
                      <Button size="sm" variant="outline" asChild>
                        <a href={`mailto:${lead.email}?subject=${encodeURIComponent("Patrichia's Store special-order request")}`}>
                          <Mail className="h-4 w-4 mr-1" />Email
                        </a>
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => markChatSpecialOrderAttended(lead.id)}>
                      <CheckCircle2 className="h-4 w-4 mr-1" />Mark attended
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or school..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="new_school_setup">New School Setup</SelectItem>
              <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
              <SelectItem value="pending_payment">Waiting for Payment</SelectItem>
              <SelectItem value="payment_initiated">Payment Started</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="ready">Ready</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as 'month' | 'all')}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
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
              <Card
                key={order.id}
                className={
                  order.is_special_order
                    ? 'border-2 border-destructive/60'
                    : order.is_new_school && order.status === 'new_school_setup'
                      ? 'border-amber-200'
                      : ''
                }
              >
                <CardContent className="p-4">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-lg">{order.customer_name}</h3>
                        <Badge className={getStatusColor(order.status)}>{getStatusLabel(order.status)}</Badge>
                        {order.is_new_school && (
                          <Badge variant="outline" className="border-amber-300 text-amber-700">
                            <School className="h-3 w-3 mr-1" />
                            New School
                          </Badge>
                        )}
                        {order.is_special_order && (
                          <Badge className="bg-destructive text-destructive-foreground">
                            Priority · Special Order
                          </Badge>
                        )}
                      </div>
                      {order.is_special_order && order.special_order_note && (
                        <p className="text-sm text-destructive font-medium">
                          Stock issue: {order.special_order_note}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Phone className="h-4 w-4" />
                          {order.customer_phone}
                        </span>
                        {order.customer_school && (
                          <span className="flex items-center gap-1">
                            <School className="h-4 w-4" />
                            {order.customer_school}
                          </span>
                        )}
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
                        {order.delivery_type === 'delivery' && order.scheduled_delivery_date && (
                          <span className="flex items-center gap-1 text-blue-600 font-medium">
                            <Truck className="h-4 w-4" />
                            Delivery: {new Date(order.scheduled_delivery_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-primary">
                        Total: Ksh {order.total_amount.toLocaleString()}
                      </p>
                      <div className="flex items-center gap-2 flex-wrap text-sm">
                        <Badge variant="outline">{order.payment_method === 'pesapal' ? 'Pesapal' : order.payment_method === 'mpesa' ? 'M-Pesa Paybill' : order.payment_method === 'cash' ? 'Cash (Pay later)' : 'Payment method not set'}</Badge>
                        <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>{order.payment_status === 'paid' ? 'Paid' : 'Payment pending'}</Badge>
                      </div>
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
                        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Order Details</DialogTitle>
                          </DialogHeader>
                          {selectedOrder && (
                            <div className="space-y-4">
                              {selectedOrder.is_new_school && (
                                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                  <div className="flex items-center gap-2 text-amber-800">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span className="font-medium">New School – Setup Required</span>
                                  </div>
                                  <p className="text-sm text-amber-700 mt-1">
                                    Create the school profile to process this order.
                                  </p>
                                </div>
                              )}
                              
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
                                  <p className="font-medium break-words">{selectedOrder.delivery_location}</p>
                                  {getDeliveryMapUrl(selectedOrder.delivery_location) && (
                                    <a
                                      href={getDeliveryMapUrl(selectedOrder.delivery_location)!}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                      <MapPin className="h-3 w-3" /> Open exact location in Google Maps
                                    </a>
                                  )}
                                </div>
                              )}

                              <div>
                                <p className="text-sm text-muted-foreground mb-2">Items</p>
                                <div className="space-y-3">
                                  {selectedOrder.order_items?.map((item) => (
                                    <div
                                      key={item.id}
                                      className="p-3 bg-muted rounded-lg space-y-2"
                                    >
                                      <div className="flex justify-between">
                                        <div>
                                          <p className="font-medium">{item.product_name}</p>
                                          <p className="text-sm text-muted-foreground">
                                            Size: {item.size} × {item.quantity}
                                          </p>
                                          {item.color && (
                                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                              <Palette className="h-3 w-3" />
                                              Color: {item.color}
                                            </p>
                                          )}
                                        </div>
                                        <p className="font-medium">
                                          Ksh {item.price_at_purchase.toLocaleString()}
                                        </p>
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-2">
                                        {item.printing_required && (
                                          <Badge variant="secondary">
                                            <Printer className="h-3 w-3 mr-1" />
                                            Logo printing
                                          </Badge>
                                        )}
                                        
                                        {item.sample_image_url && (
                                          <a
                                            href={item.sample_image_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                          >
                                            <ImageIcon className="h-3 w-3" />
                                            View Sample
                                            <ExternalLink className="h-3 w-3" />
                                          </a>
                                        )}
                                      </div>
                                      
                                      {item.sample_image_url && (
                                        <div className="mt-2">
                                          <img
                                            src={item.sample_image_url}
                                            alt="Customer sample"
                                            className="w-20 h-20 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => window.open(item.sample_image_url!, '_blank')}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="rounded-lg border p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium">Payment</span>
                                  <Badge variant={selectedOrder.payment_status === 'paid' ? 'default' : 'secondary'}>
                                    {selectedOrder.payment_status === 'paid' ? 'Paid' : 'Pending'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">Method: {selectedOrder.payment_method === 'pesapal' ? 'Pesapal' : selectedOrder.payment_method === 'mpesa' ? 'M-Pesa Paybill' : selectedOrder.payment_method === 'cash' ? 'Cash (Pay later)' : 'Not recorded'}</p>
                                {selectedOrder.payment_reference && <p className="text-sm text-muted-foreground">Reference: {selectedOrder.payment_reference}</p>}
                                {selectedOrder.payment_status !== 'paid' && (
                                  <Button size="sm" className="w-full" onClick={() => markOrderPaid(selectedOrder)}>Mark Payment Received</Button>
                                )}
                              </div>

                              <div className="flex justify-between items-center p-3 bg-primary/10 rounded-lg">
                                <span className="font-semibold">Total</span>
                                <span className="text-xl font-bold text-primary">
                                  Ksh {selectedOrder.total_amount.toLocaleString()}
                                </span>
                              </div>

                              {/* Delivery Scheduling for delivery orders */}
                              {selectedOrder.delivery_type === 'delivery' && (
                                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                                  <div className="flex items-center gap-2 text-blue-800">
                                    <Truck className="h-4 w-4" />
                                    <span className="font-medium">Delivery Scheduling</span>
                                  </div>
                                  {selectedOrder.scheduled_delivery_date ? (
                                    <p className="text-sm text-blue-700">
                                      📅 Scheduled: <strong>{new Date(selectedOrder.scheduled_delivery_date).toLocaleDateString('en-KE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                                    </p>
                                  ) : (
                                    <p className="text-sm text-blue-600 italic">No delivery date scheduled yet.</p>
                                  )}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button variant="outline" size="sm" className="border-blue-300 text-blue-700">
                                        <CalendarDays className="h-4 w-4 mr-1" />
                                        {selectedOrder.scheduled_delivery_date ? 'Reschedule' : 'Schedule Delivery'}
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                      <CalendarComponent
                                        mode="single"
                                        selected={selectedOrder.scheduled_delivery_date ? new Date(selectedOrder.scheduled_delivery_date) : undefined}
                                        onSelect={(date) => {
                                          if (date) scheduleDelivery(selectedOrder.id, date);
                                        }}
                                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              )}

                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  className="flex-1"
                                  onClick={() => printReceipt(selectedOrder)}
                                >
                                  <Printer className="h-4 w-4 mr-1" />
                                  Print Receipt
                                </Button>
                                {selectedOrder.is_new_school && selectedOrder.status === 'new_school_setup' && (
                                  <Button
                                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                                    onClick={() => handleCreateSchoolProfile(selectedOrder)}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Create School Profile
                                  </Button>
                                )}
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

                      {/* Create School Profile button for new school orders */}
                      {order.is_new_school && order.status === 'new_school_setup' && (
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-700"
                          onClick={() => handleCreateSchoolProfile(order)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Create School Profile
                        </Button>
                      )}

                      {order.payment_status !== 'paid' && (
                        <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => markOrderPaid(order)}>
                          Mark Paid
                        </Button>
                      )}

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
                          onClick={() => updateOrderStatus(order.id, 'processing')}
                        >
                          Start Processing
                        </Button>
                      )}
                      {order.status === 'pending' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateOrderStatus(order.id, 'processing')}
                        >
                          Start Processing
                        </Button>
                      )}
                      {order.status === 'processing' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                        >
                          Mark Ready
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button
                          size="sm"
                          onClick={() => updateOrderStatus(order.id, 'out_for_delivery')}
                        >
                          Out for Delivery
                        </Button>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700"
                          onClick={() => updateOrderStatus(order.id, 'delivered')}
                        >
                          Mark Delivered
                        </Button>
                      )}
                      {order.status === 'delivered' && (
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

      <Dialog open={Boolean(schoolProfileOrder)} onOpenChange={(open) => !open && setSchoolProfileOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create School Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="orderSchoolProfileName">School name</Label>
            <Input
              id="orderSchoolProfileName"
              value={schoolProfileName}
              onChange={(event) => setSchoolProfileName(event.target.value)}
              placeholder="Enter the school's official name"
            />
            <p className="text-sm text-muted-foreground">
              The new profile will be linked directly to this order. Existing matching school profiles will be reused.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchoolProfileOrder(null)} disabled={isCreatingSchoolProfile}>Cancel</Button>
            <Button onClick={saveSchoolProfileForOrder} disabled={isCreatingSchoolProfile || !schoolProfileName.trim()}>
              {isCreatingSchoolProfile ? 'Creating…' : 'Create and link profile'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
