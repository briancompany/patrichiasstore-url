import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, Search, RefreshCw, Download, Plus, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Payment {
  id: string;
  order_id: string;
  amount: number;
  mpesa_code: string;
  customer_name: string;
  customer_phone: string | null;
  verified_at: string;
  created_at: string;
}

interface PendingOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  created_at: string;
}

export default function AdminPayments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showManualDialog, setShowManualDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [manualMpesaCode, setManualMpesaCode] = useState('');
  const [manualAmount, setManualAmount] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments, isLoading, refetch } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Payment[];
    },
  });

  // Fetch orders awaiting payment (for manual verification)
  const { data: pendingOrders } = useQuery({
    queryKey: ['pending-payment-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ['pending', 'awaiting_payment', 'new_school_setup'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingOrder[];
    },
  });

  const filteredPayments = payments?.filter((payment) => {
    const search = searchTerm.toLowerCase();
    return (
      payment.customer_name.toLowerCase().includes(search) ||
      payment.mpesa_code.toLowerCase().includes(search) ||
      payment.customer_phone?.toLowerCase().includes(search) ||
      payment.order_id.toLowerCase().includes(search)
    );
  });

  const totalAmount = payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

  const handleManualVerify = async () => {
    if (!selectedOrder || !manualMpesaCode.trim()) {
      toast.error('Please enter M-Pesa code');
      return;
    }

    const amount = parseInt(manualAmount) || selectedOrder.total_amount;

    setIsProcessing(true);

    try {
      // Update order status
      const { error: orderError } = await supabase
        .from('orders')
        .update({ 
          status: 'confirmed',
          notes: `Manual verification - M-Pesa Code: ${manualMpesaCode}`
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      // Record payment
      const { error: paymentError } = await supabase
        .from('payments')
        .insert({
          order_id: selectedOrder.id,
          amount,
          mpesa_code: manualMpesaCode,
          customer_name: selectedOrder.customer_name,
          customer_phone: selectedOrder.customer_phone || null,
        });

      if (paymentError) throw paymentError;

      toast.success('Payment verified successfully!');
      setShowManualDialog(false);
      setSelectedOrder(null);
      setManualMpesaCode('');
      setManualAmount('');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['pending-payment-orders'] });
    } catch (error) {
      console.error('Error verifying payment:', error);
      toast.error('Failed to verify payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const openManualVerify = (order: PendingOrder) => {
    setSelectedOrder(order);
    setManualAmount(order.total_amount.toString());
    setShowManualDialog(true);
  };

  const exportPayments = () => {
    if (!payments || payments.length === 0) {
      toast.error('No payments to export');
      return;
    }

    const headers = ['Date', 'Customer', 'Phone', 'M-Pesa Code', 'Amount (Ksh)', 'Order ID'];
    const rows = payments.map((p) => [
      format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
      p.customer_name,
      p.customer_phone || 'N/A',
      p.mpesa_code,
      p.amount.toString(),
      p.order_id,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Payments exported!');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground">View and manage M-Pesa payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportPayments}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{payments?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                Ksh {totalAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Today's Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {payments?.filter((p) => {
                  const today = new Date().toDateString();
                  return new Date(p.created_at).toDateString() === today;
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-800">Awaiting Payment</CardTitle>
              <CreditCard className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-700">
                {pendingOrders?.length || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Orders - Manual Verification */}
        {pendingOrders && pendingOrders.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <Plus className="h-5 w-5" />
                Orders Awaiting Payment (Manual Verification)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {pendingOrders.slice(0, 10).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
                  >
                    <div>
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {order.customer_phone} • Ksh {order.total_amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'MMM d, HH:mm')}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => openManualVerify(order)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Verify Payment
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, phone, or M-Pesa code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Payments Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Loading payments...</div>
            ) : !filteredPayments || filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm ? 'No payments match your search' : 'No payments recorded yet'}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>M-Pesa Code</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {format(new Date(payment.created_at), 'MMM d, yyyy')}
                        <br />
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(payment.created_at), 'HH:mm')}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">{payment.customer_name}</TableCell>
                      <TableCell>{payment.customer_phone || '-'}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-sm">{payment.mpesa_code}</code>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        Ksh {payment.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge className="bg-green-100 text-green-800">Verified</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Manual Verification Dialog */}
      <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manual Payment Verification</DialogTitle>
            <DialogDescription>
              Verify payment manually when the customer's M-Pesa paste failed
            </DialogDescription>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{selectedOrder.customer_name}</p>
                <p className="text-sm text-muted-foreground">{selectedOrder.customer_phone}</p>
                <p className="text-lg font-bold text-primary mt-2">
                  Expected: Ksh {selectedOrder.total_amount.toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="mpesaCode">M-Pesa Transaction Code</Label>
                <Input
                  id="mpesaCode"
                  value={manualMpesaCode}
                  onChange={(e) => setManualMpesaCode(e.target.value.toUpperCase())}
                  placeholder="e.g., ABC123XYZ"
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount Received (Ksh)</Label>
                <Input
                  id="amount"
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowManualDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleManualVerify} disabled={isProcessing || !manualMpesaCode.trim()}>
                  {isProcessing ? 'Verifying...' : 'Confirm Payment'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
