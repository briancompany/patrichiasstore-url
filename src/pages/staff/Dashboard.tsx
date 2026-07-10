import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FilePlus, History, Users, Download, LogOut, MessageCircle } from 'lucide-react';
import storeLogo from '@/assets/logo-with-patrichia.png';

const STORE_WHATSAPP = '254726075180';

function StaffCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: typeof FilePlus;
  title: string;
  description: string;
}) {
  return (
    <Link to={to}>
      <Card className="hover:shadow-lg transition-shadow h-full">
        <CardContent className="p-6 flex flex-col items-start gap-3">
          <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const { staff, isLoading, isStaff } = useStaffAuth();

  useEffect(() => {
    if (!isLoading && !isStaff) navigate('/staff/login', { replace: true });
  }, [isLoading, isStaff, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/staff/login', { replace: true });
  };

  const openWhatsApp = () => {
    const msg = encodeURIComponent(`Hello Patrichia's Store, this is ${staff?.full_name || 'staff'}.`);
    window.open(`https://wa.me/${STORE_WHATSAPP}?text=${msg}`, '_blank');
  };

  if (isLoading || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={storeLogo} alt="Patrichia's Store" className="h-10 w-10 object-contain" />
            <div>
              <p className="font-semibold leading-tight">Patrichia's Store</p>
              <p className="text-xs text-muted-foreground">Staff · {staff?.full_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-1" /> Sign out
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">Welcome, {staff?.full_name?.split(' ')[0]}</h1>
          <p className="text-muted-foreground text-sm">Manage quotations and customers</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StaffCard
            to="/staff/quotations/new"
            icon={FilePlus}
            title="New Quotation"
            description="Build a quote for a customer"
          />
          <StaffCard
            to="/staff/quotations"
            icon={History}
            title="Quotation History"
            description="Search and reopen past quotes"
          />
          <StaffCard
            to="/staff/customers"
            icon={Users}
            title="Customers"
            description="Find customers and their history"
          />
          <a href="/downloads/patrichias-store.apk" download>
            <Card className="hover:shadow-lg transition-shadow h-full">
              <CardContent className="p-6 flex flex-col items-start gap-3">
                <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Download className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Download App</h3>
                  <p className="text-sm text-muted-foreground mt-1">Install the store app on your phone</p>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>
      </main>

      <button
        onClick={openWhatsApp}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-whatsapp text-whatsapp-foreground shadow-lg hover:shadow-xl flex items-center justify-center"
        aria-label="Contact store on WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </button>
    </div>
  );
}