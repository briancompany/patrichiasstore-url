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
} from 'lucide-react';
import storeLogo from '@/assets/logo-with-patrichia.png';
import { Button } from '@/components/ui/button';

const STORE_WHATSAPP = '254726075180';

const NAV = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/quotations/new', label: 'New Quotation', icon: FilePlus },
  { to: '/staff/quotations', label: 'Quotation History', icon: History },
  { to: '/staff/price-book', label: 'Price Book', icon: BookOpen },
  { to: '/staff/customers', label: 'Customers', icon: Users },
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
    <div className="min-h-screen bg-muted">
      {/* Top bar */}
      <header className="bg-primary text-primary-foreground border-b-2 border-gold sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link to="/staff" className="flex items-center gap-3 min-w-0">
            <img src={storeLogo} alt="Patrichia's Store" className="h-9 w-9 rounded object-contain bg-white/5 p-0.5" />
            <div className="min-w-0">
              <p className="font-serif text-gold leading-tight truncate">Patrichia's Store</p>
              <p className="text-[10px] tracking-[0.2em] uppercase opacity-70 truncate">Staff Portal · {staff?.full_name}</p>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="text-primary-foreground hover:bg-white/10 hidden sm:inline-flex"
            >
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
            <button
              className="md:hidden text-gold p-2 -mr-2"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Desktop nav bar */}
        <nav className="hidden md:block border-t border-white/10 bg-primary/95">
          <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'text-gold border-gold'
                      : 'text-primary-foreground/80 border-transparent hover:text-gold'
                  }`
                }
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Mobile nav drawer */}
        {open && (
          <nav className="md:hidden border-t border-white/10 bg-primary animate-fade-in">
            <div className="px-4 py-2 grid grid-cols-1 gap-1">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-md text-sm ${
                      isActive ? 'bg-gold text-primary' : 'text-primary-foreground/90 hover:bg-white/10'
                    }`
                  }
                >
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </NavLink>
              ))}
              <button
                onClick={signOut}
                className="flex items-center gap-3 px-3 py-3 rounded-md text-sm text-primary-foreground/90 hover:bg-white/10 text-left"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </nav>
        )}
      </header>

      {title && (
        <div className="bg-primary text-primary-foreground">
          <div className="max-w-7xl mx-auto px-4 pb-6">
            <span className="gold-pill mt-2">Staff Portal</span>
            <h1 className="font-serif text-3xl md:text-4xl text-gold mt-3">{title}</h1>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>

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