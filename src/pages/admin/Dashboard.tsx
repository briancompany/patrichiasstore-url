import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Package, ClipboardList, School, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalSchools: number;
  todayOrders: number;
  totalRevenue: number;
  lowStockCount: number;
}

interface RecentOrder {
  id: string;
  customer_name: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    totalSchools: 0,
    todayOrders: 0,
    totalRevenue: 0,
    lowStockCount: 0,
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Fetch orders stats
      const { data: ordersData } = await supabase.from('orders').select('*');
      const orders = ordersData || [];
      const pendingOrders = orders.filter((o) => o.status === 'pending').length;
      const totalRevenue = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

      // Today's orders
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = orders.filter((o) => new Date(o.created_at) >= today).length;

      // Fetch schools count
      const { count: schoolsCount } = await supabase
        .from('schools')
        .select('*', { count: 'exact', head: true });

      // Fetch recent orders
      const { data: recent } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      setStats({
        totalProducts: productsCount || 0,
        totalOrders: orders.length,
        pendingOrders,
        totalSchools: schoolsCount || 0,
        todayOrders,
        totalRevenue,
        lowStockCount: 0, // Will implement with product stock tracking
      });

      setRecentOrders(recent || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      link: '/admin/products',
    },
    {
      title: 'Pending Orders',
      value: stats.pendingOrders,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      link: '/admin/orders',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders,
      icon: ClipboardList,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      link: '/admin/orders',
    },
    {
      title: 'Schools',
      value: stats.totalSchools,
      icon: School,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      link: '/admin/schools',
    },
    {
      title: "Today's Orders",
      value: stats.todayOrders,
      icon: TrendingUp,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100',
      link: '/admin/orders',
    },
    {
      title: 'Total Revenue',
      value: `Ksh ${stats.totalRevenue.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      link: '/admin/analytics',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back! Here's your store overview.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Link key={stat.title} to={stat.link}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`${stat.bgColor} p-3 rounded-full`}>
                      <stat.icon className={`h-6 w-6 ${stat.color}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Low Stock Alert */}
        {stats.lowStockCount > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800">Low Stock Alert</h3>
                <p className="text-sm text-orange-700">
                  {stats.lowStockCount} products are running low on stock
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link to="/admin/products?filter=low-stock">View Products</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Orders</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/orders">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No orders yet</p>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                  >
                    <div>
                      <p className="font-medium">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                      <span className="font-semibold">Ksh {order.total_amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button asChild size="lg" className="h-auto py-4">
            <Link to="/admin/products/new" className="flex flex-col items-center gap-2">
              <Package className="h-6 w-6" />
              Add New Product
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-auto py-4">
            <Link to="/admin/schools/new" className="flex flex-col items-center gap-2">
              <School className="h-6 w-6" />
              Add New School
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-auto py-4">
            <Link to="/admin/orders" className="flex flex-col items-center gap-2">
              <ClipboardList className="h-6 w-6" />
              Manage Orders
            </Link>
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
