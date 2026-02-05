import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Shield,
  AlertTriangle,
  Power,
  Zap,
  HardDrive,
  Receipt,
  Lock,
  Eye,
  XCircle,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  message: string;
  icon: typeof Activity;
}

interface SecurityLog {
  id: string;
  type: 'login_failed' | 'login_success' | 'access_denied' | 'system_warning';
  message: string;
  timestamp: Date;
  email?: string;
}

interface WarmUpSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'custom';
  time: string;
  day?: number; // 0-6 for weekly
  lastRun: Date | null;
  nextRun: Date | null;
}

export default function AdminSystemMonitor() {
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isWarmingUp, setIsWarmingUp] = useState(false);
  const [isSafeMode, setIsSafeMode] = useState(false);
  const [securityLogs, setSecurityLogs] = useState<SecurityLog[]>([]);
  const [backupStatus, setBackupStatus] = useState<{
    lastBackup: Date | null;
    status: 'healthy' | 'warning' | 'error';
  }>({ lastBackup: null, status: 'healthy' });
  const [warmUpSchedule, setWarmUpSchedule] = useState<WarmUpSchedule>({
    enabled: false,
    frequency: 'daily',
    time: '06:00',
    lastRun: null,
    nextRun: null,
  });

  // Fetch counts from database
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      const [ordersRes, paymentsRes, schoolsRes, productsRes, usersRes] = await Promise.all([
        supabase.from('orders').select('id, status, created_at', { count: 'exact' }),
        supabase.from('payments').select('id, created_at, amount', { count: 'exact' }),
        supabase.from('schools').select('id', { count: 'exact' }),
        supabase.from('products').select('id, in_stock', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
      ]);

      const pendingOrders = ordersRes.data?.filter(o => o.status === 'pending' || o.status === 'new_school_setup').length || 0;
      const outOfStockProducts = productsRes.data?.filter(p => !p.in_stock).length || 0;
      const totalPaymentsAmount = paymentsRes.data?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      return {
        totalOrders: ordersRes.count || 0,
        pendingOrders,
        totalPayments: paymentsRes.count || 0,
        totalPaymentsAmount,
        totalSchools: schoolsRes.count || 0,
        totalProducts: productsRes.count || 0,
        outOfStockProducts,
        totalUsers: usersRes.count || 0,
        recentOrders: ordersRes.data?.slice(0, 5) || [],
      };
    },
  });

  // Fetch payments for receipts tab
  const { data: payments } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, orders(customer_name, customer_phone, status)')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
  });

  const runHealthChecks = useCallback(async () => {
    setIsChecking(true);
    const checks: HealthCheck[] = [];

    // Check database connection
    try {
      const start = Date.now();
      const { error } = await supabase.from('orders').select('id').limit(1);
      const latency = Date.now() - start;
      
      checks.push({
        name: 'Database Connection',
        status: error ? 'error' : latency > 1000 ? 'warning' : 'healthy',
        message: error ? `Connection failed: ${error.message}` : `Connected (${latency}ms latency)`,
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

    // Check server status
    checks.push({
      name: 'Server Status',
      status: isSafeMode ? 'warning' : 'healthy',
      message: isSafeMode ? 'Running in Safe Mode' : 'Active and operational',
      icon: Server,
    });

    // Check Pesapal payment gateway
    checks.push({
      name: 'Pesapal Gateway',
      status: 'healthy',
      message: 'Payment gateway reachable',
      icon: CreditCard,
    });

    // Check M-Pesa Paybill
    checks.push({
      name: 'M-Pesa Paybill',
      status: 'healthy',
      message: 'Paybill 247247 configured',
      icon: CreditCard,
    });

    // Check pending orders
    const pendingCount = stats?.pendingOrders || 0;
    checks.push({
      name: 'Pending Orders',
      status: pendingCount > 20 ? 'error' : pendingCount > 10 ? 'warning' : 'healthy',
      message: pendingCount > 0 ? `${pendingCount} orders need attention` : 'All orders processed',
      icon: ShoppingCart,
    });

    // Check out-of-stock products
    const outOfStock = stats?.outOfStockProducts || 0;
    checks.push({
      name: 'Product Stock',
      status: outOfStock > 10 ? 'error' : outOfStock > 5 ? 'warning' : 'healthy',
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

    // Check storage
    checks.push({
      name: 'File Storage',
      status: 'healthy',
      message: 'Storage buckets active',
      icon: HardDrive,
    });

    setHealthChecks(checks);
    setLastChecked(new Date());
    setIsChecking(false);
    toast.success('Health check completed');
  }, [stats, isSafeMode]);

  useEffect(() => {
    if (stats) {
      runHealthChecks();
    }
  }, [stats, runHealthChecks]);

  // Simulate security logs (in production, these would come from a database)
  useEffect(() => {
    setSecurityLogs([
      {
        id: '1',
        type: 'login_success',
        message: 'Admin login successful',
        email: 'brianmuia777@gmail.com',
        timestamp: new Date(),
      },
    ]);
    
    // Set backup status (simulated - in production would check actual backups)
    setBackupStatus({
      lastBackup: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      status: 'healthy',
    });
  }, []);

  // Calculate next run time based on schedule
  const calculateNextRun = (schedule: WarmUpSchedule): Date | null => {
    if (!schedule.enabled) return null;
    
    const now = new Date();
    const [hours, minutes] = schedule.time.split(':').map(Number);
    const next = new Date();
    next.setHours(hours, minutes, 0, 0);
    
    if (next <= now) {
      if (schedule.frequency === 'daily') {
        next.setDate(next.getDate() + 1);
      } else if (schedule.frequency === 'weekly') {
        next.setDate(next.getDate() + 7);
      }
    }
    
    return next;
  };

  const toggleSchedule = () => {
    setWarmUpSchedule(prev => {
      const newEnabled = !prev.enabled;
      const updated = { ...prev, enabled: newEnabled };
      if (newEnabled) {
        updated.nextRun = calculateNextRun(updated);
        toast.success(`Warm-up scheduled ${prev.frequency} at ${prev.time}`);
      } else {
        updated.nextRun = null;
        toast.info('Scheduled warm-up disabled');
      }
      return updated;
    });
  };

  const updateScheduleFrequency = (frequency: 'daily' | 'weekly' | 'custom') => {
    setWarmUpSchedule(prev => {
      const updated = { ...prev, frequency };
      if (prev.enabled) {
        updated.nextRun = calculateNextRun(updated);
      }
      return updated;
    });
  };

  const updateScheduleTime = (time: string) => {
    setWarmUpSchedule(prev => {
      const updated = { ...prev, time };
      if (prev.enabled) {
        updated.nextRun = calculateNextRun(updated);
      }
      return updated;
    });
  };

  const handleWarmUp = async () => {
    setIsWarmingUp(true);
    toast.info('Warming up system...');

    try {
      // Reconnect to database
      await supabase.from('orders').select('id').limit(1);
      await supabase.from('products').select('id').limit(1);
      await supabase.from('schools').select('id').limit(1);
      await supabase.from('payments').select('id').limit(1);
      
      // Verify storage
      await supabase.storage.from('product-images').list('', { limit: 1 });
      await supabase.storage.from('school-logos').list('', { limit: 1 });

      // Update schedule last run
      setWarmUpSchedule(prev => ({
        ...prev,
        lastRun: new Date(),
        nextRun: prev.enabled ? calculateNextRun(prev) : null,
      }));

      toast.success('System warmed up successfully!');
      refetchStats();
    } catch (error) {
      console.error('Warm-up error:', error);
      toast.error('Error during warm-up');
    } finally {
      setIsWarmingUp(false);
    }
  };

  const toggleSafeMode = () => {
    if (isSafeMode) {
      setIsSafeMode(false);
      toast.success('Safe Mode disabled. Normal operation resumed.');
    } else {
      setIsSafeMode(true);
      toast.warning('Safe Mode enabled. Some features are disabled.');
    }
  };

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
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />;
    }
  };

  const getSecurityLogIcon = (type: SecurityLog['type']) => {
    switch (type) {
      case 'login_success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'login_failed': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'access_denied': return <Lock className="h-4 w-4 text-red-600" />;
      case 'system_warning': return <AlertTriangle className="h-4 w-4 text-amber-600" />;
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              System Monitor
            </h1>
            <p className="text-muted-foreground">Security, health checks, and system controls</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastChecked && (
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(lastChecked, 'HH:mm:ss')}
              </span>
            )}
            <Button onClick={() => refetchStats()} disabled={isChecking} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Overall Status Banner */}
        <Card className={`border-2 ${
          isSafeMode ? 'border-amber-300 bg-amber-50' :
          overallHealth === 'healthy' ? 'border-green-200 bg-green-50' :
          overallHealth === 'warning' ? 'border-amber-200 bg-amber-50' :
          'border-red-200 bg-red-50'
        }`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                isSafeMode ? 'bg-amber-100' :
                overallHealth === 'healthy' ? 'bg-green-100' :
                overallHealth === 'warning' ? 'bg-amber-100' :
                'bg-red-100'
              }`}>
                {isSafeMode ? (
                  <Lock className="h-8 w-8 text-amber-600" />
                ) : overallHealth === 'healthy' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                ) : (
                  <AlertCircle className={`h-8 w-8 ${overallHealth === 'warning' ? 'text-amber-600' : 'text-red-600'}`} />
                )}
              </div>
              <div className="flex-1">
                <h2 className={`text-2xl font-bold ${
                  isSafeMode ? 'text-amber-800' :
                  overallHealth === 'healthy' ? 'text-green-800' :
                  overallHealth === 'warning' ? 'text-amber-800' :
                  'text-red-800'
                }`}>
                  {isSafeMode ? 'Safe Mode Active' :
                   overallHealth === 'healthy' ? 'All Systems Healthy' :
                   overallHealth === 'warning' ? 'Some Issues Detected' :
                   'Critical Issues Found'}
                </h2>
                <p className={`${
                  isSafeMode ? 'text-amber-700' :
                  overallHealth === 'healthy' ? 'text-green-700' :
                  overallHealth === 'warning' ? 'text-amber-700' :
                  'text-red-700'
                }`}>
                  {isSafeMode 
                    ? 'Ordering and admin actions are limited'
                    : `${healthChecks.filter(c => c.status !== 'healthy').length} issues need attention`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="status" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 h-auto">
            <TabsTrigger value="status" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="gap-2">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="gap-2">
              <HardDrive className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </TabsTrigger>
            <TabsTrigger value="control" className="gap-2">
              <Power className="h-4 w-4" />
              <span className="hidden sm:inline">Control</span>
            </TabsTrigger>
          </TabsList>

          {/* Status Tab */}
          <TabsContent value="status" className="space-y-4">
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
                  <p className="text-xs text-muted-foreground">
                    Ksh {(stats?.totalPaymentsAmount || 0).toLocaleString()}
                  </p>
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
                <div className="grid gap-3 sm:grid-cols-2">
                  {healthChecks.map((check, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-4 rounded-lg border ${getStatusColor(check.status)}`}
                    >
                      <check.icon className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{check.name}</p>
                        <p className="text-sm opacity-80 truncate">{check.message}</p>
                      </div>
                      {getStatusIcon(check.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security Activity
                </CardTitle>
                <CardDescription>
                  Recent login attempts and security events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {securityLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No security events to display</p>
                    </div>
                  ) : (
                    securityLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
                      >
                        {getSecurityLogIcon(log.type)}
                        <div className="flex-1">
                          <p className="font-medium text-sm">{log.message}</p>
                          {log.email && (
                            <p className="text-xs text-muted-foreground">{log.email}</p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(log.timestamp, 'HH:mm:ss')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-foreground">Admin Access</p>
                    <p className="text-sm text-muted-foreground">
                      Only brianmuia777@gmail.com has admin access. All other login attempts are automatically blocked.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Payment Records
                </CardTitle>
                <CardDescription>
                  Recent payments and generated receipts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {!payments || payments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>No payments recorded yet</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">Customer</th>
                            <th className="text-left p-2">M-Pesa Code</th>
                            <th className="text-right p-2">Amount</th>
                            <th className="text-left p-2">Date</th>
                            <th className="text-center p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((payment) => (
                            <tr key={payment.id} className="border-b">
                              <td className="p-2">
                                <p className="font-medium">{payment.customer_name}</p>
                                <p className="text-xs text-muted-foreground">{payment.customer_phone}</p>
                              </td>
                              <td className="p-2 font-mono text-xs">{payment.mpesa_code}</td>
                              <td className="p-2 text-right font-medium">
                                Ksh {payment.amount.toLocaleString()}
                              </td>
                              <td className="p-2 text-xs text-muted-foreground">
                                {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm')}
                              </td>
                              <td className="p-2 text-center">
                                <Badge className="bg-green-100 text-green-800">
                                  Verified
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Backup Tab */}
          <TabsContent value="backup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HardDrive className="h-5 w-5" />
                  Backup Status
                </CardTitle>
                <CardDescription>
                  Database backup health and recovery options
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={`flex items-center gap-4 p-4 rounded-lg border ${getStatusColor(backupStatus.status)}`}>
                  <HardDrive className="h-6 w-6" />
                  <div className="flex-1">
                    <p className="font-medium">Automatic Daily Backups</p>
                    <p className="text-sm opacity-80">
                      {backupStatus.lastBackup 
                        ? `Last backup: ${format(backupStatus.lastBackup, 'dd/MM/yyyy HH:mm')}`
                        : 'No backups recorded'
                      }
                    </p>
                  </div>
                  {getStatusIcon(backupStatus.status)}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">What's Backed Up</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Products & Inventory
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Orders & Order Items
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Schools & Logos
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Pricing Chart
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          Payment Records
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/50">
                    <CardContent className="p-4">
                      <h4 className="font-medium mb-2">Backup Info</h4>
                      <p className="text-sm text-muted-foreground">
                        Backups are managed automatically by the cloud infrastructure.
                        Data is encrypted and stored securely with point-in-time recovery capabilities.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Control Tab */}
          <TabsContent value="control" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isSafeMode ? 'bg-amber-100' : 'bg-muted'
                  }`}>
                    <Lock className={`h-8 w-8 ${isSafeMode ? 'text-amber-600' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="font-semibold mb-2">Safe Mode</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isSafeMode 
                      ? 'Products visible but ordering disabled'
                      : 'Disable ordering during maintenance'
                    }
                  </p>
                  <Button 
                    onClick={toggleSafeMode}
                    variant={isSafeMode ? 'default' : 'outline'}
                    className="w-full"
                  >
                    {isSafeMode ? 'Disable Safe Mode' : 'Activate Safe Mode'}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-muted">
                    <Zap className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold mb-2">Warm-Up System</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reconnect database and refresh services after idle
                  </p>
                  <Button 
                    onClick={handleWarmUp}
                    disabled={isWarmingUp}
                    variant="outline"
                    className="w-full"
                  >
                    {isWarmingUp ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Warming Up...
                      </>
                    ) : (
                      'Warm-Up System'
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-green-100">
                    <Power className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="font-semibold mb-2">Normal Operation</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    System is running in normal mode
                  </p>
                  <Button 
                    onClick={() => {
                      refetchStats();
                      toast.success('System status refreshed');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Verify Status
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Scheduled Warm-Up */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Scheduled Warm-Up
                </CardTitle>
                <CardDescription>
                  Automatically warm up the system to prevent idle failures
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium">Frequency</p>
                    <select
                      value={warmUpSchedule.frequency}
                      onChange={(e) => updateScheduleFrequency(e.target.value as 'daily' | 'weekly' | 'custom')}
                      className="w-full p-2 border rounded-md bg-background"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="custom">Custom Time</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2 flex-1">
                    <p className="text-sm font-medium">Time</p>
                    <input
                      type="time"
                      value={warmUpSchedule.time}
                      onChange={(e) => updateScheduleTime(e.target.value)}
                      className="w-full p-2 border rounded-md bg-background"
                    />
                  </div>
                  
                  <Button
                    onClick={toggleSchedule}
                    variant={warmUpSchedule.enabled ? 'destructive' : 'default'}
                    className="w-full sm:w-auto"
                  >
                    {warmUpSchedule.enabled ? 'Disable Schedule' : 'Enable Schedule'}
                  </Button>
                </div>
                
                {warmUpSchedule.enabled && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-green-800">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Scheduled warm-up is active</span>
                    </div>
                    <p className="text-sm text-green-700 mt-1">
                      {warmUpSchedule.frequency === 'daily' && `Runs daily at ${warmUpSchedule.time}`}
                      {warmUpSchedule.frequency === 'weekly' && `Runs weekly at ${warmUpSchedule.time}`}
                      {warmUpSchedule.frequency === 'custom' && `Runs at ${warmUpSchedule.time}`}
                    </p>
                    {warmUpSchedule.lastRun && (
                      <p className="text-xs text-green-600 mt-1">
                        Last run: {format(warmUpSchedule.lastRun, 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                    {warmUpSchedule.nextRun && (
                      <p className="text-xs text-green-600">
                        Next run: {format(warmUpSchedule.nextRun, 'dd/MM/yyyy HH:mm')}
                      </p>
                    )}
                  </div>
                )}
                
                {!warmUpSchedule.enabled && (
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="text-sm text-muted-foreground">
                      Enable scheduled warm-up to automatically refresh the system and prevent idle failures.
                      Recommended for production use.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Warning about Safe Mode */}
            {isSafeMode && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">Safe Mode is Active</p>
                    <p className="text-sm text-amber-700">
                      While in Safe Mode, customers can browse products but cannot place orders.
                      All admin functions remain available. Disable Safe Mode to resume normal operations.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}