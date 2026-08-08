import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import {
  LayoutDashboard,
  FilePlus,
  History,
  BookOpen,
  Users,
  BarChart3,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  MessageCircle,
  Package,
  ClipboardList,
} from 'lucide-react';
import storeLogo from '@/assets/logo-with-patrichia.png';
import { Button } from '@/components/ui/button';

const STORE_WHATSAPP = '254726075180';

const NAV = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/quotations/new', label: 'New Quotation', icon: FilePlus },
  { to: '/staff/quotations', label: 'Quotation History', icon: History },
  { to: '/staff/price-book', label: 'Price Book', icon: BookOpen },
  { to: '/staff/products', label: 'Products', icon: Package },
  { to: '/staff/customers', label: 'Customers', icon: Users },
  { to: '/staff/orders', label: 'Orders', icon: ClipboardList },
  { to: '/staff/reports', label: 'Reports', icon: BarChart3 },
  { to: '/staff/settings', label: 'Settings', icon: SettingsIcon },
];

export function StaffLayout({ children, title }: { children: ReactNode; title?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { staff, isLoading, isStaff } = useStaffAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isStaff) navigate('/staff/login', { replace: true });
  }, [isLoading, isStaff, navigate]);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/staff/login', { replace: true });
  };

  if (isLoading || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted md:flex">
      {/* Mobile drawer backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed z-50 inset-y-0 left-0 w-[262px] bg-primary text-primary-foreground border-r border-gold/30 flex flex-col transition-transform duration-200 md:translate-x-0 md:sticky md:top-0 md:h-screen md:shrink-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Link to="/staff" className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <img
            src={storeLogo}
            alt="Patrichia's Store"
            className="h-11 w-11 rounded-lg object-contain bg-white/5 p-1 ring-1 ring-gold/40"
          />
          <div className="min-w-0">
            <p className="font-serif text-gold leading-tight truncate">Patrichia's Store</p>
            <p className="text-[10px] tracking-[0.2em] uppercase opacity-70 truncate">Staff Portal</p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'bg-gold text-primary font-semibold shadow'
                    : 'text-primary-foreground/80 hover:bg-white/10 hover:text-gold'
                }`
              }
            >
              <n.icon className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <p className="px-3 pb-2 text-[11px] text-primary-foreground/60 truncate">
            {staff?.full_name}
          </p>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-primary-foreground/80 hover:bg-white/10 hover:text-gold"
          >
            <LogOut className="h-[18px] w-[18px]" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-primary/95 backdrop-blur text-primary-foreground border-b-2 border-gold">
          <div className="px-4 py-3 flex items-center gap-3">
            <button
              className="md:hidden text-gold p-2 -ml-2"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.25em] uppercase text-gold/80">Staff Portal</p>
              <h1 className="font-serif text-lg md:text-xl text-gold truncate">
                {title || 'Dashboard'}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground hover:bg-white/10 hidden md:inline-flex"
            >
              <LogOut className="h-4 w-4 mr-1" /> Sign Out
            </Button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>

      <a
        href={`https://wa.me/${STORE_WHATSAPP}`}
        target="_blank"
        rel="noopener"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg hover:shadow-xl flex items-center justify-center"
        aria-label="Contact store on WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>
    </div>
  );
}