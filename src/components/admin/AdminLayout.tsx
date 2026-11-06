import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Package,
  School,
  ClipboardList,
  Users,
  Tag,
  BarChart3,
  MousePointerClick,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  CreditCard,
  FileImage,
  UserCog,
  Megaphone,
  BellRing,
} from 'lucide-react';
import storeLogo from '@/assets/logo-with-patrichia-256.png';
import { supabase } from '@/integrations/supabase/client';

interface AdminLayoutProps {
  children: ReactNode;
}

const navItems = [
  { name: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Products', path: '/admin/products', icon: Package },
  { name: 'Schools', path: '/admin/schools', icon: School },
  { name: 'Pricing', path: '/admin/pricing', icon: Tag },
  { name: 'Orders', path: '/admin/orders', icon: ClipboardList },
  { name: 'Payments', path: '/admin/payments', icon: CreditCard },
  { name: 'Users', path: '/admin/users', icon: Users },
  { name: 'Staff', path: '/admin/staff', icon: UserCog },
  { name: 'Ads', path: '/admin/ads', icon: Megaphone },
  { name: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
  { name: 'Visitor Heatmap', path: '/admin/visitors', icon: MousePointerClick },
  { name: 'Store Content', path: '/admin/store-content', icon: FileImage },
  { name: 'Monitor', path: '/admin/monitor', icon: AlertTriangle },
  { name: 'Settings', path: '/admin/settings', icon: Settings },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile, isAdmin, isLoading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [specialOrderCount, setSpecialOrderCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refreshSpecialOrderCount = async () => {
      const [ordersResult, leadsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id', { count: 'exact', head: true })
          .eq('is_special_order', true)
          .not('status', 'in', '("awaiting_payment","pending_payment","payment_initiated","declined","completed","delivered")'),
        supabase
          .from('chat_leads')
          .select('id', { count: 'exact', head: true })
          .eq('lead_type', 'special_order')
          .eq('is_handled', false),
      ]);
      if (active && !ordersResult.error && !leadsResult.error) {
        setSpecialOrderCount((ordersResult.count ?? 0) + (leadsResult.count ?? 0));
      }
    };
    void refreshSpecialOrderCount();
    const channel = supabase
      .channel('admin-special-order-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => void refreshSpecialOrderCount())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_leads' }, () => void refreshSpecialOrderCount())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="h-16 w-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have admin privileges. Please contact the store owner to get access.
          </p>
          <div className="flex gap-4 justify-center">
            <Button variant="outline" onClick={() => navigate('/')}>
              Go to Store
            </Button>
            <Button onClick={handleSignOut}>Sign Out</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-40 flex items-center justify-between px-4">
        <Link to="/admin/dashboard" className="flex items-center gap-2">
          <img src={storeLogo} alt="Patrichia's Store" className="h-8 w-8 object-contain" />
          <span className="font-bold text-lg">Admin</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="h-6 w-6" /> : <span className="relative"><Menu className="h-6 w-6" />{specialOrderCount > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-destructive" />}</span>}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50 transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 border-b border-border">
          <Link to="/admin/dashboard" className="flex items-center gap-2">
            <img src={storeLogo} alt="Patrichia's Store" className="h-8 w-8 object-contain" />
            <span className="font-bold text-xl">Patrichia's</span>
          </Link>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {item.path === '/admin/orders' && specialOrderCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-xs font-semibold text-destructive-foreground" aria-label={`${specialOrderCount} active special orders`}>
                  <BellRing className="h-3.5 w-3.5" />{specialOrderCount}
                </span>
              )}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border">
          <div className="mb-3 px-3">
            <p className="text-sm font-medium text-foreground">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-muted-foreground">Administrator</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild className="flex-1">
              <Link to="/">View Store</Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
