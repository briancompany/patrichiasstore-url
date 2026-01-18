import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Database,
  RefreshCw,
  Server,
  ShoppingCart,
  Users,
  CreditCard,
  School,
  Package,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  icon: typeof Activity;
}

export default function AdminSystemMonitor() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Fetch counts from database
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const [ordersRes, paymentsRes, schoolsRes, productsRes, usersRes] = await Promise.all([
        supabase.from('orders').select('id, status, created_at', { count: 'exact' }),
        supabase.from('payments').select('id, created_at', { count: 'exact' }),
        supabase.from('schools').select('id', { count: 'exact' }),
        supabase.from('products').select('id, in_stock', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
      ]);

      const pendingOrders = ordersRes.data?.filter(o => o.status === 'pending' || o.status === 'new_school_setup').length || 0;
      const outOfStockProducts = productsRes.data?.filter(p => !p.in_stock).length || 0;

      return {
        totalOrders: ordersRes.count || 0,
        pendingOrders,
        totalPayments: paymentsRes.count || 0,
        totalSchools: schoolsRes.count || 0,
        totalProducts: productsRes.count || 0,
        outOfStockProducts,
        totalUsers: usersRes.count || 0,
        recentOrders: ordersRes.data?.slice(0, 5) || [],
      };
    },
  });

  const runHealthChecks = async () => {
    setIsChecking(true);
    const checks: HealthCheck[] = [];

    // Check database connection
    try {
      const { error } = await supabase.from('orders').select('id').limit(1);
      checks.push({
        name: 'Database Connection',
        status: error ? 'error' : 'healthy',
        message: error ? `Connection failed: ${error.message}` : 'Connected to Supabase',
        icon: Database,
      });
    } catch {
      checks.push({
        name: 'Database Connection',
        status: 'error',
        message: 'Failed to connect to database',
        icon: Database,
      });
    }

    // Check pending orders
    const pendingCount = stats?.pendingOrders || 0;
    checks.push({
      name: 'Pending Orders',
      status: pendingCount > 10 ? 'warning' : pendingCount > 20 ? 'error' : 'healthy',
      message: pendingCount > 0 ? `${pendingCount} orders need attention` : 'All orders processed',
      icon: ShoppingCart,
    });

    // Check out-of-stock products
    const outOfStock = stats?.outOfStockProducts || 0;
    checks.push({
      name: 'Product Stock',
      status: outOfStock > 5 ? 'warning' : outOfStock > 10 ? 'error' : 'healthy',
      message: outOfStock > 0 ? `${outOfStock} products out of stock` : 'All products in stock',
      icon: Package,
    });

    // Check schools without logos
    try {
      const { data: schoolsNoLogo } = await supabase
        .from('schools')
        .select('id')
        .is('logo_url', null);
      const noLogoCount = schoolsNoLogo?.length || 0;
      checks.push({
        name: 'School Logos',
        status: noLogoCount > 5 ? 'warning' : 'healthy',
        message: noLogoCount > 0 ? `${noLogoCount} schools missing logos` : 'All schools have logos',
        icon: School,
      });
    } catch {
      checks.push({
        name: 'School Logos',
        status: 'error',
        message: 'Failed to check school logos',
        icon: School,
      });
    }

    // Check new school orders
    try {
      const { data: newSchoolOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('is_new_school', true)
        .eq('status', 'new_school_setup');
      const newSchoolCount = newSchoolOrders?.length || 0;
      checks.push({
        name: 'New School Setup',
        status: newSchoolCount > 0 ? 'warning' : 'healthy',
        message: newSchoolCount > 0 ? `${newSchoolCount} orders need school setup` : 'No pending school setups',
        icon: Users,
      });
    } catch {
      checks.push({
        name: 'New School Setup',
        status: 'error',
        message: 'Failed to check new school orders',
        icon: Users,
      });
    }

    // Check unverified payments (orders awaiting payment)
    try {
      const { data: awaitingPayment } = await supabase
        .from('orders')
        .select('id')
        .eq('status', 'awaiting_payment');
      const awaitingCount = awaitingPayment?.length || 0;
      checks.push({
        name: 'Payment Status',
        status: awaitingCount > 10 ? 'warning' : 'healthy',
        message: awaitingCount > 0 ? `${awaitingCount} orders awaiting payment` : 'All payments processed',
        icon: CreditCard,
      });
    } catch {
      checks.push({
        name: 'Payment Status',
        status: 'error',
        message: 'Failed to check payment status',
        icon: CreditCard,
      });
    }

    setHealthChecks(checks);
    setLastChecked(new Date());
    setIsChecking(false);
    toast.success('Health check completed');
  };

  useEffect(() => {
    if (stats) {
      runHealthChecks();
    }
  }, [stats]);

  const getStatusColor = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800 border-green-200';
      case 'warning': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'error': return 'bg-red-100 text-red-800 border-red-200';
    }
  };

  const getStatusIcon = (status: 'healthy' | 'warning' | 'error') => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertCircle className="h-5 w-5 text-amber-600" />;
      case 'error': return <AlertCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const overallHealth = healthChecks.some(c => c.status === 'error')
    ? 'error'
    : healthChecks.some(c => c.status === 'warning')
    ? 'warning'
    : 'healthy';

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">System Monitor</h1>
            <p className="text-muted-foreground">Check system health and identify issues</p>
          </div>
          <div className="flex items-center gap-4">
            {lastChecked && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                Last checked: {format(lastChecked, 'HH:mm:ss')}
              </span>
            )}
            <Button onClick={() => { refetchStats(); }} disabled={isChecking}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Run Health Check
            </Button>
          </div>
        </div>

        {/* Overall Status */}
        <Card className={`border-2 ${
          overallHealth === 'healthy' ? 'border-green-200 bg-green-50' :
          overallHealth === 'warning' ? 'border-amber-200 bg-amber-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                overallHealth === 'healthy' ? 'bg-green-100' :
                overallHealth === 'warning' ? 'bg-amber-100' :
                'bg-red-100'
              }`}>
                {overallHealth === 'healthy' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className={`h-8 w-8 ${overallHealth === 'warning' ? 'text-amber-600' : 'text-red-600'}`} />
                )}
              </div>
              <div>
                <h2 className={`text-2xl font-bold ${
                  overallHealth === 'healthy' ? 'text-green-800' :
                  overallHealth === 'warning' ? 'text-amber-800' :
                  'text-red-800'
                }`}>
                  {overallHealth === 'healthy' ? 'All Systems Healthy' :
                   overallHealth === 'warning' ? 'Some Issues Detected' :
                   'Critical Issues Found'}
                </h2>
                <p className={`${
                  overallHealth === 'healthy' ? 'text-green-700' :
                  overallHealth === 'warning' ? 'text-amber-700' :
                  'text-red-700'
                }`}>
                  {healthChecks.filter(c => c.status !== 'healthy').length} issues need attention
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.pendingOrders || 0} pending
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payments</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalPayments || 0}</div>
              <p className="text-xs text-muted-foreground">verified payments</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Schools</CardTitle>
              <School className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalSchools || 0}</div>
              <p className="text-xs text-muted-foreground">registered schools</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalProducts || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.outOfStockProducts || 0} out of stock
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Health Checks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              System Health Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {healthChecks.map((check, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${getStatusColor(check.status)}`}
                >
                  <check.icon className="h-5 w-5" />
                  <div className="flex-1">
                    <p className="font-medium">{check.name}</p>
                    <p className="text-sm opacity-80">{check.message}</p>
                  </div>
                  {getStatusIcon(check.status)}
                </div>
              ))}
              {healthChecks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Click "Run Health Check" to check system status</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Issues Summary */}
        {healthChecks.filter(c => c.status !== 'healthy').length > 0 && (
          <Card className="border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-800">
                <AlertCircle className="h-5 w-5" />
                Issues Requiring Attention
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {healthChecks.filter(c => c.status !== 'healthy').map((check, index) => (
                  <div key={index} className="flex items-center gap-3 text-sm">
                    <Badge variant={check.status === 'error' ? 'destructive' : 'secondary'}>
                      {check.status}
                    </Badge>
                    <span className="font-medium">{check.name}:</span>
                    <span className="text-muted-foreground">{check.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
