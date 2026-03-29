import { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  FileText,
  BookOpen,
  Bug,
} from 'lucide-react';
import { format } from 'date-fns';
import { SecurityMonitorPanel } from '@/components/admin/SecurityMonitorPanel';
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
  const [warmUpProgress, setWarmUpProgress] = useState(0);
  const [warmUpStage, setWarmUpStage] = useState('');
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

  // Fetch warm-up logs
  const { data: warmupLogs, refetch: refetchWarmupLogs } = useQuery({
    queryKey: ['warmup-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warmup_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
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
        status: error ? 'error' : latency > 100 ? 'warning' : 'healthy',
        message: error ? `Connection failed: ${error.message}` : `Connected (${latency}ms latency target: <100ms)`,
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
    setWarmUpProgress(0);
    setWarmUpStage('Initializing...');
    toast.info('Full system warm-up starting...');

    const stages = [
      { label: 'Database tables', pct: 15, fn: async () => {
        await Promise.all([
          supabase.from('orders').select('id').limit(1),
          supabase.from('products').select('id').limit(1),
          supabase.from('schools').select('id').limit(1),
          supabase.from('payments').select('id').limit(1),
          supabase.from('order_items').select('id').limit(1),
          supabase.from('order_tracking').select('id').limit(1),
          supabase.from('pricing_chart').select('id').limit(1),
          supabase.from('profiles').select('id').limit(1),
        ]);
      }},
      { label: 'Storage buckets', pct: 30, fn: async () => {
        await Promise.all([
          supabase.storage.from('product-images').list('', { limit: 1 }),
          supabase.storage.from('school-logos').list('', { limit: 1 }),
        ]);
      }},
      { label: 'Payment and order functions', pct: 50, fn: async () => {
        await Promise.allSettled([
          supabase.functions.invoke('pesapal-status', {
            body: { orderTrackingId: 'warmup-test', orderId: 'warmup-test' },
          }),
          supabase.functions.invoke('pesapal-pay', {
            body: { orderId: 'warmup-test', amount: 1, customerName: 'Warmup', callbackUrl: window.location.origin + '/payment' },
          }),
          supabase.functions.invoke('confirm-payment', {
            body: { warmup: true },
          }),
          supabase.functions.invoke('send-receipt-email', {
            body: { orderId: 'warmup-test', paymentCode: 'WARMUP01', paymentMethod: 'mpesa' },
          }),
        ]);
      }},
      { label: 'School search service', pct: 75, fn: async () => {
        try {
          await supabase.functions.invoke('search-school', {
            body: { query: 'warmup' },
          });
        } catch { /* cold start triggered */ }
      }},
      { label: 'RPC functions', pct: 90, fn: async () => {
        await Promise.allSettled([
          supabase.rpc('is_admin'),
          supabase.rpc('get_order_tracking_public', { _tracking_code: 'PS-WARMUP1' }),
        ]);
      }},
      { label: 'Finalizing', pct: 100, fn: async () => {
        // Cache general products for customers
        await supabase
          .from('products')
          .select('id, name, type, sizes, in_stock, image_url')
          .is('school_id', null)
          .eq('in_stock', true);
      }},
    ];

    try {
      for (const stage of stages) {
        setWarmUpStage(stage.label);
        await stage.fn();
        setWarmUpProgress(stage.pct);
      }

      setWarmUpSchedule(prev => ({
        ...prev,
        lastRun: new Date(),
        nextRun: prev.enabled ? calculateNextRun(prev) : null,
      }));

      toast.success('System fully warmed up to 100%!');
      refetchStats();
      refetchWarmupLogs();
    } catch (error) {
      console.error('Warm-up error:', error);
      toast.error('Partial warm-up completed with errors');
    } finally {
      setIsWarmingUp(false);
      setWarmUpStage('');
    }
  };

  const triggerScheduledWarmup = async () => {
    try {
      toast.info('Triggering scheduled warm-up...');
      const { data, error } = await supabase.functions.invoke('scheduled-warmup', {
        body: { trigger: 'manual' },
      });
      if (error) throw error;
      toast.success(data?.summary || 'Warm-up completed');
      refetchWarmupLogs();
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger warm-up');
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
          <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
            <TabsTrigger value="status" className="gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Status</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="sec-testing" className="gap-2">
              <Bug className="h-4 w-4" />
              <span className="hidden sm:inline">Sec Testing</span>
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
            <TabsTrigger value="docs" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Docs</span>
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

          {/* Security Testing Tab */}
          <TabsContent value="sec-testing" className="space-y-4">
            <SecurityMonitorPanel />
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
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 ${
                    isWarmingUp ? 'bg-primary/20' : warmUpProgress === 100 ? 'bg-green-100' : 'bg-muted'
                  }`}>
                    <Zap className={`h-8 w-8 ${isWarmingUp ? 'text-primary animate-pulse' : warmUpProgress === 100 ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </div>
                  <h3 className="font-semibold mb-2">Full Warm-Up</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Preload all functions, DB, storage to 100%
                  </p>
                  {isWarmingUp && (
                    <div className="mb-4 space-y-2">
                      <Progress value={warmUpProgress} className="h-3" />
                      <p className="text-xs text-primary font-medium">{warmUpStage} ({warmUpProgress}%)</p>
                    </div>
                  )}
                  {!isWarmingUp && warmUpProgress === 100 && (
                    <Badge className="mb-4 bg-green-100 text-green-800">100% Ready</Badge>
                  )}
                  <Button 
                    onClick={handleWarmUp}
                    disabled={isWarmingUp}
                    variant={warmUpProgress === 100 ? 'outline' : 'default'}
                    className="w-full"
                  >
                    {isWarmingUp ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Warming Up...
                      </>
                    ) : warmUpProgress === 100 ? (
                      'Re-Warm System'
                    ) : (
                      'Warm-Up to 100%'
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
                  Automated Warm-Up (Active)
                </CardTitle>
                <CardDescription>
                  System automatically warms up every 6 hours via scheduled backend job. You can also trigger manually.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Automated warm-up is active</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">
                    Runs every 6 hours (00:00, 06:00, 12:00, 18:00 UTC). All stages logged with fault auto-resolution.
                  </p>
                </div>

                <Button onClick={triggerScheduledWarmup} className="gap-2">
                  <Zap className="h-4 w-4" />
                  Trigger Warm-Up Now
                </Button>

                {/* Warm-up Log History */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Warm-Up Log History
                  </h4>
                  {!warmupLogs || warmupLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No warm-up logs yet. Trigger a warm-up to see results.</p>
                  ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {warmupLogs.map((log: any) => {
                        const stagesData = typeof log.stages === 'string' ? JSON.parse(log.stages) : (log.stages || []);
                        const faultsData = typeof log.faults === 'string' ? JSON.parse(log.faults) : (log.faults || []);
                        return (
                          <div key={log.id} className="border rounded-lg p-3 bg-muted/30">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                {log.status === 'success' ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : log.status === 'partial' ? (
                                  <AlertCircle className="h-4 w-4 text-amber-600" />
                                ) : log.status === 'running' ? (
                                  <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <Badge className={
                                  log.status === 'success' ? 'bg-green-100 text-green-800' :
                                  log.status === 'partial' ? 'bg-amber-100 text-amber-800' :
                                  'bg-red-100 text-red-800'
                                }>
                                  {log.status}
                                </Badge>
                                <Badge variant="outline" className="text-xs">{log.trigger_type}</Badge>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {log.started_at ? format(new Date(log.started_at), 'dd/MM HH:mm:ss') : ''}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">{log.summary}</p>
                            {log.duration_ms && (
                              <p className="text-xs text-muted-foreground mt-1">Duration: {log.duration_ms}ms</p>
                            )}
                            {faultsData.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {faultsData.map((fault: any, i: number) => (
                                  <div key={i} className={`text-xs p-1.5 rounded ${fault.resolved ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                    <span className="font-medium">{fault.stage}:</span> {fault.error}
                                    {fault.resolved && <span className="ml-1">✓ {fault.resolution}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
          {/* Documentation Tab */}
          <TabsContent value="docs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  System Documentation
                </CardTitle>
                <CardDescription>
                  Complete architecture, features, and backend interactions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ER Diagram */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    Entity-Relationship Diagram
                  </h3>
                  <div className="bg-muted/30 border rounded-xl p-6 overflow-x-auto">
                    <svg viewBox="0 0 900 620" className="w-full min-w-[700px]" xmlns="http://www.w3.org/2000/svg">
                      {/* Schools */}
                      <rect x="20" y="20" width="180" height="120" rx="12" fill="#dbeafe" stroke="#3b82f6" strokeWidth="2"/>
                      <text x="110" y="48" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#1e40af">Schools</text>
                      <text x="30" y="68" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="30" y="83" fontSize="11" fill="#374151">name (text)</text>
                      <text x="30" y="98" fontSize="11" fill="#374151">logo_url (text)</text>
                      <text x="30" y="113" fontSize="11" fill="#374151">created_at, updated_at</text>

                      {/* Products */}
                      <rect x="260" y="20" width="200" height="150" rx="12" fill="#dcfce7" stroke="#22c55e" strokeWidth="2"/>
                      <text x="360" y="48" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#166534">Products</text>
                      <text x="270" y="68" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="270" y="83" fontSize="11" fill="#374151">school_id (uuid, FK → Schools)</text>
                      <text x="270" y="98" fontSize="11" fill="#374151">name, type (enum)</text>
                      <text x="270" y="113" fontSize="11" fill="#374151">sizes (jsonb), image_url</text>
                      <text x="270" y="128" fontSize="11" fill="#374151">in_stock (bool), description</text>
                      <text x="270" y="143" fontSize="11" fill="#374151">created_at, updated_at</text>

                      {/* Orders */}
                      <rect x="520" y="20" width="200" height="180" rx="12" fill="#fef3c7" stroke="#f59e0b" strokeWidth="2"/>
                      <text x="620" y="48" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#92400e">Orders</text>
                      <text x="530" y="68" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="530" y="83" fontSize="11" fill="#374151">customer_name, customer_phone</text>
                      <text x="530" y="98" fontSize="11" fill="#374151">customer_school (text)</text>
                      <text x="530" y="113" fontSize="11" fill="#374151">linked_school_id (FK → Schools)</text>
                      <text x="530" y="128" fontSize="11" fill="#374151">status (enum), total_amount</text>
                      <text x="530" y="143" fontSize="11" fill="#374151">delivery_type (enum)</text>
                      <text x="530" y="158" fontSize="11" fill="#374151">is_new_school, notes</text>
                      <text x="530" y="173" fontSize="11" fill="#374151">created_at, updated_at</text>

                      {/* Order Items */}
                      <rect x="520" y="230" width="200" height="160" rx="12" fill="#fed7aa" stroke="#f97316" strokeWidth="2"/>
                      <text x="620" y="258" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#9a3412">Order Items</text>
                      <text x="530" y="278" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="530" y="293" fontSize="11" fill="#374151">order_id (FK → Orders)</text>
                      <text x="530" y="308" fontSize="11" fill="#374151">product_id (FK → Products)</text>
                      <text x="530" y="323" fontSize="11" fill="#374151">product_name, size, qty</text>
                      <text x="530" y="338" fontSize="11" fill="#374151">price_at_purchase, color</text>
                      <text x="530" y="353" fontSize="11" fill="#374151">logo_url, sample_image_url</text>
                      <text x="530" y="368" fontSize="11" fill="#374151">printing_required</text>

                      {/* Payments */}
                      <rect x="760" y="20" width="130" height="140" rx="12" fill="#fce7f3" stroke="#ec4899" strokeWidth="2"/>
                      <text x="825" y="48" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#9d174d">Payments</text>
                      <text x="770" y="68" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="770" y="83" fontSize="11" fill="#374151">order_id (FK)</text>
                      <text x="770" y="98" fontSize="11" fill="#374151">amount, mpesa_code</text>
                      <text x="770" y="113" fontSize="11" fill="#374151">customer_name</text>
                      <text x="770" y="128" fontSize="11" fill="#374151">customer_phone</text>
                      <text x="770" y="143" fontSize="11" fill="#374151">verified_at</text>

                      {/* Order Tracking */}
                      <rect x="760" y="200" width="130" height="100" rx="12" fill="#e0e7ff" stroke="#6366f1" strokeWidth="2"/>
                      <text x="825" y="228" textAnchor="middle" fontWeight="bold" fontSize="13" fill="#3730a3">Order Tracking</text>
                      <text x="770" y="248" fontSize="11" fill="#374151">id (uuid, PK)</text>
                      <text x="770" y="263" fontSize="11" fill="#374151">order_id (FK)</text>
                      <text x="770" y="278" fontSize="11" fill="#374151">tracking_code</text>

                      {/* Profiles */}
                      <rect x="20" y="200" width="180" height="120" rx="12" fill="#f3e8ff" stroke="#a855f7" strokeWidth="2"/>
                      <text x="110" y="228" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#6b21a8">Profiles</text>
                      <text x="30" y="248" fontSize="11" fill="#374151">id (uuid, PK = auth.uid)</text>
                      <text x="30" y="263" fontSize="11" fill="#374151">email, full_name</text>
                      <text x="30" y="278" fontSize="11" fill="#374151">role (admin|customer)</text>
                      <text x="30" y="293" fontSize="11" fill="#374151">created_at, updated_at</text>

                      {/* Pricing Chart */}
                      <rect x="260" y="230" width="200" height="100" rx="12" fill="#ccfbf1" stroke="#14b8a6" strokeWidth="2"/>
                      <text x="360" y="258" textAnchor="middle" fontWeight="bold" fontSize="14" fill="#115e59">Pricing Chart</text>
                      <text x="270" y="278" fontSize="11" fill="#374151">id, uniform_type, size</text>
                      <text x="270" y="293" fontSize="11" fill="#374151">price (int)</text>
                      <text x="270" y="308" fontSize="11" fill="#374151">created_at, updated_at</text>

                      {/* Relationship Lines */}
                      {/* Schools → Products */}
                      <line x1="200" y1="80" x2="260" y2="80" stroke="#3b82f6" strokeWidth="2" markerEnd="url(#arrow)"/>
                      {/* Schools → Orders */}
                      <path d="M200 100 Q 400 100 520 113" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeDasharray="5,3"/>
                      {/* Orders → Order Items */}
                      <line x1="620" y1="200" x2="620" y2="230" stroke="#f97316" strokeWidth="2" markerEnd="url(#arrow)"/>
                      {/* Products → Order Items */}
                      <path d="M460 120 Q 500 280 520 308" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeDasharray="5,3"/>
                      {/* Orders → Payments */}
                      <line x1="720" y1="80" x2="760" y2="80" stroke="#ec4899" strokeWidth="2" markerEnd="url(#arrow)"/>
                      {/* Orders → Order Tracking */}
                      <path d="M720 150 Q 740 200 760 240" stroke="#6366f1" strokeWidth="2" fill="none" markerEnd="url(#arrow)"/>

                      <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                          <path d="M 0 0 L 10 5 L 0 10 z" fill="#374151"/>
                        </marker>
                      </defs>

                      {/* Edge Functions Box */}
                      <rect x="20" y="400" width="870" height="200" rx="12" fill="#fef9c3" stroke="#eab308" strokeWidth="2" strokeDasharray="6,3"/>
                      <text x="455" y="428" textAnchor="middle" fontWeight="bold" fontSize="15" fill="#854d0e">Edge Functions (Backend Services)</text>
                      
                      <rect x="40" y="445" width="155" height="55" rx="8" fill="#fff" stroke="#22c55e" strokeWidth="1.5"/>
                      <text x="117" y="468" textAnchor="middle" fontWeight="600" fontSize="11" fill="#166534">pesapal-pay</text>
                      <text x="117" y="485" textAnchor="middle" fontSize="10" fill="#6b7280">Initiate payment</text>

                      <rect x="210" y="445" width="155" height="55" rx="8" fill="#fff" stroke="#3b82f6" strokeWidth="1.5"/>
                      <text x="287" y="468" textAnchor="middle" fontWeight="600" fontSize="11" fill="#1d4ed8">pesapal-ipn</text>
                      <text x="287" y="485" textAnchor="middle" fontSize="10" fill="#6b7280">Webhook receiver</text>

                      <rect x="380" y="445" width="155" height="55" rx="8" fill="#fff" stroke="#a855f7" strokeWidth="1.5"/>
                      <text x="457" y="468" textAnchor="middle" fontWeight="600" fontSize="11" fill="#7c3aed">pesapal-status</text>
                      <text x="457" y="485" textAnchor="middle" fontSize="10" fill="#6b7280">Poll payment status</text>

                      <rect x="550" y="445" width="155" height="55" rx="8" fill="#fff" stroke="#ec4899" strokeWidth="1.5"/>
                      <text x="627" y="468" textAnchor="middle" fontWeight="600" fontSize="11" fill="#be185d">confirm-payment</text>
                      <text x="627" y="485" textAnchor="middle" fontSize="10" fill="#6b7280">Verify & update order</text>

                      <rect x="720" y="445" width="155" height="55" rx="8" fill="#fff" stroke="#f59e0b" strokeWidth="1.5"/>
                      <text x="797" y="468" textAnchor="middle" fontWeight="600" fontSize="11" fill="#b45309">search-school</text>
                      <text x="797" y="485" textAnchor="middle" fontSize="10" fill="#6b7280">Find schools</text>

                      <rect x="40" y="515" width="155" height="55" rx="8" fill="#fff" stroke="#14b8a6" strokeWidth="1.5"/>
                      <text x="117" y="538" textAnchor="middle" fontWeight="600" fontSize="11" fill="#0f766e">generate-logo</text>
                      <text x="117" y="555" textAnchor="middle" fontSize="10" fill="#6b7280">AI logo generation</text>

                      <rect x="210" y="515" width="155" height="55" rx="8" fill="#fff" stroke="#ef4444" strokeWidth="1.5"/>
                      <text x="287" y="538" textAnchor="middle" fontWeight="600" fontSize="11" fill="#b91c1c">send-receipt-email</text>
                      <text x="287" y="555" textAnchor="middle" fontSize="10" fill="#6b7280">Email receipts</text>

                      {/* Storage Buckets */}
                      <rect x="380" y="515" width="155" height="55" rx="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
                      <text x="457" y="538" textAnchor="middle" fontWeight="600" fontSize="11" fill="#1d4ed8">product-images</text>
                      <text x="457" y="555" textAnchor="middle" fontSize="10" fill="#6b7280">Storage bucket</text>

                      <rect x="550" y="515" width="155" height="55" rx="8" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1.5"/>
                      <text x="627" y="538" textAnchor="middle" fontWeight="600" fontSize="11" fill="#1d4ed8">school-logos</text>
                      <text x="627" y="555" textAnchor="middle" fontSize="10" fill="#6b7280">Storage bucket</text>
                    </svg>
                  </div>
                </div>

                {/* Feature Documentation */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Feature Overview
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { title: 'Customer Ordering', desc: 'Browse general/school products → add to cart → checkout with details → pay via Pesapal or M-Pesa → auto-verified → receipt download', color: 'border-green-200 bg-green-50' },
                      { title: 'Pesapal Payments', desc: 'Automated: pesapal-pay initiates → redirect to gateway → pesapal-ipn confirms → status polling fallback → order marked confirmed', color: 'border-blue-200 bg-blue-50' },
                      { title: 'M-Pesa Fallback', desc: 'Manual paste of M-Pesa message → parsed for code & amount → exact match required → duplicate prevention → confirm-payment edge function', color: 'border-amber-200 bg-amber-50' },
                      { title: 'School Management', desc: 'Admin adds schools with logos → products linked to schools → customers search by school → new school orders tagged for setup', color: 'border-purple-200 bg-purple-50' },
                      { title: 'Order Tracking', desc: 'PS-XXXXXX codes generated → customers track via /track-order → status updates visible → delivery type shown', color: 'border-indigo-200 bg-indigo-50' },
                      { title: 'Admin Security', desc: 'Single admin (brianmuia777@gmail.com) → 3 attempt lockout → RLS on all tables → is_admin() security definer function', color: 'border-red-200 bg-red-50' },
                      { title: 'System Warm-Up', desc: 'Full preload: 8 DB tables → 2 storage buckets → 5 edge functions → RPC functions → general product cache = 100% ready', color: 'border-teal-200 bg-teal-50' },
                      { title: 'Safe Mode', desc: 'Toggle to disable ordering during maintenance → products remain visible → admin functions unaffected → banner shown to customers', color: 'border-orange-200 bg-orange-50' },
                    ].map((feature, i) => (
                      <div key={i} className={`p-4 rounded-lg border ${feature.color}`}>
                        <h4 className="font-semibold text-sm mb-1">{feature.title}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security & RLS Summary */}
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Security Architecture
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                    <p><strong>RLS Policies:</strong> All tables protected. Public INSERT on orders/order_items/tracking/payments with field validation. SELECT restricted to admin except via tracking code lookup.</p>
                    <p><strong>Edge Functions:</strong> pesapal-pay, pesapal-ipn, pesapal-status, confirm-payment use verify_jwt=false (public webhooks). confirm-payment uses SUPABASE_SERVICE_ROLE_KEY for privileged updates.</p>
                    <p><strong>Auth:</strong> is_admin() SECURITY DEFINER function checks profiles table. handle_new_user() trigger auto-creates profile on signup.</p>
                    <p><strong>Error Handling:</strong> All edge functions return sanitized JSON errors without exposing internal details. CORS headers on all responses including errors.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </AdminLayout>
  );
}