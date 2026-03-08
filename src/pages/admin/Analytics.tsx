import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { TrendingUp, Package, ShoppingCart, DollarSign, Star } from 'lucide-react';
import { LowStockAlerts } from '@/components/admin/LowStockAlerts';

interface OrderStats {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  completedOrders: number;
  totalReviews: number;
}

export default function AdminAnalytics() {
  const [stats, setStats] = useState<OrderStats>({
    totalRevenue: 0, totalOrders: 0, avgOrderValue: 0, completedOrders: 0, totalReviews: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [ordersByStatus, setOrdersByStatus] = useState<{ name: string; value: number }[]>([]);
  const [revenueByDay, setRevenueByDay] = useState<{ day: string; revenue: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const [{ data: ordersData }, { data: orderItems }, { data: reviewsData }] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('order_items').select('product_name, quantity'),
        supabase.from('product_reviews').select('id'),
      ]);

      const orders = ordersData || [];
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const completedOrders = orders.filter((o) => o.status === 'completed').length;

      setStats({
        totalRevenue, totalOrders,
        avgOrderValue: Math.round(avgOrderValue),
        completedOrders,
        totalReviews: reviewsData?.length || 0,
      });

      // Orders by status
      const statusCounts = orders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      setOrdersByStatus([
        { name: 'Pending', value: statusCounts['pending'] || 0 },
        { name: 'Processing', value: statusCounts['processing'] || 0 },
        { name: 'Ready', value: statusCounts['ready'] || 0 },
        { name: 'Delivered', value: statusCounts['delivered'] || 0 },
        { name: 'Completed', value: statusCounts['completed'] || 0 },
      ]);

      // Revenue by day (last 7 days)
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayRevenue = orders
          .filter((o) => o.created_at.startsWith(dayStr))
          .reduce((sum, o) => sum + (o.total_amount || 0), 0);
        last7Days.push({ day: dayName, revenue: dayRevenue });
      }
      setRevenueByDay(last7Days);

      // Top products
      if (orderItems) {
        const productCounts = orderItems.reduce((acc, item) => {
          acc[item.product_name] = (acc[item.product_name] || 0) + item.quantity;
          return acc;
        }, {} as Record<string, number>);

        setTopProducts(
          Object.entries(productCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const COLORS = ['#f59e0b', '#6366f1', '#3b82f6', '#06b6d4', '#22c55e'];

  const statCards = [
    { title: 'Total Revenue', value: `Ksh ${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    { title: 'Total Orders', value: stats.totalOrders, icon: ShoppingCart, color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { title: 'Avg. Order Value', value: `Ksh ${stats.avgOrderValue.toLocaleString()}`, icon: TrendingUp, color: 'text-purple-600', bgColor: 'bg-purple-100' },
    { title: 'Completed', value: stats.completedOrders, icon: Package, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
    { title: 'Reviews', value: stats.totalReviews, icon: Star, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  ];

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
          <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground">Track your store performance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.title}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`${stat.bgColor} p-2 rounded-full`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.title}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Low Stock Alerts */}
        <LowStockAlerts />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <Card>
            <CardHeader><CardTitle>Revenue (Last 7 Days)</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => [`Ksh ${value.toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: 'hsl(var(--primary))' }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Orders by Status */}
          <Card>
            <CardHeader><CardTitle>Orders by Status</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={ordersByStatus} cx="50%" cy="50%" labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100} fill="#8884d8" dataKey="value">
                    {ordersByStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Products */}
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Top Selling Products</CardTitle></CardHeader>
            <CardContent>
              {topProducts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No sales data yet</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topProducts} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={(value: number) => [`${value} sold`, 'Quantity']} />
                    <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
