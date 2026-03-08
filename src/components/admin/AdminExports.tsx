import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Download, FileText, Loader2, Package, ShoppingCart, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

function downloadCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminExports() {
  const [exporting, setExporting] = useState<string | null>(null);

  const exportOrders = async () => {
    setExporting('orders');
    const { data } = await supabase
      .from('orders')
      .select('id, customer_name, customer_phone, customer_school, delivery_type, delivery_location, status, total_amount, created_at, scheduled_delivery_date')
      .order('created_at', { ascending: false });

    if (data) {
      downloadCSV('orders-export.csv',
        ['Order ID', 'Customer', 'Phone', 'School', 'Delivery', 'Location', 'Status', 'Amount', 'Date', 'Delivery Date'],
        data.map((o) => [
          o.id, o.customer_name, o.customer_phone, o.customer_school || '',
          o.delivery_type, o.delivery_location || '', o.status,
          String(o.total_amount), new Date(o.created_at).toLocaleDateString(),
          o.scheduled_delivery_date || '',
        ])
      );
      toast.success(`Exported ${data.length} orders`);
    }
    setExporting(null);
  };

  const exportProducts = async () => {
    setExporting('products');
    const { data } = await supabase
      .from('products')
      .select('id, name, type, in_stock, stock_quantity, created_at')
      .order('name');

    if (data) {
      downloadCSV('products-export.csv',
        ['ID', 'Name', 'Type', 'In Stock', 'Stock Qty', 'Created'],
        data.map((p) => [
          p.id, p.name, p.type, p.in_stock ? 'Yes' : 'No',
          String(p.stock_quantity), new Date(p.created_at).toLocaleDateString(),
        ])
      );
      toast.success(`Exported ${data.length} products`);
    }
    setExporting(null);
  };

  const exportPayments = async () => {
    setExporting('payments');
    const { data } = await supabase
      .from('payments')
      .select('id, order_id, customer_name, customer_phone, mpesa_code, amount, created_at')
      .order('created_at', { ascending: false });

    if (data) {
      downloadCSV('payments-export.csv',
        ['ID', 'Order ID', 'Customer', 'Phone', 'M-Pesa Code', 'Amount', 'Date'],
        data.map((p) => [
          p.id, p.order_id, p.customer_name, p.customer_phone || '',
          p.mpesa_code, String(p.amount), new Date(p.created_at).toLocaleDateString(),
        ])
      );
      toast.success(`Exported ${data.length} payments`);
    }
    setExporting(null);
  };

  const exports = [
    { key: 'orders', title: 'Orders', desc: 'All orders with customer details', icon: ShoppingCart, action: exportOrders },
    { key: 'products', title: 'Products', desc: 'Product inventory with stock levels', icon: Package, action: exportProducts },
    { key: 'payments', title: 'Payments', desc: 'All payment transactions', icon: DollarSign, action: exportPayments },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Export Reports
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {exports.map((exp) => (
          <Card key={exp.key}>
            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
              <exp.icon className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{exp.title}</p>
                <p className="text-xs text-muted-foreground">{exp.desc}</p>
              </div>
              <Button onClick={exp.action} disabled={exporting === exp.key} className="w-full gap-2" size="sm">
                {exporting === exp.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
