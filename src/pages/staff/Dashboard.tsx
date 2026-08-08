import { Link } from 'react-router-dom';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  FilePlus,
  History,
  Users,
  Download,
  Package,
  ClipboardList,
  BookOpen,
  BarChart3,
} from 'lucide-react';

const TILES = [
  { to: '/staff/quotations/new', icon: FilePlus, title: 'New Quotation', description: 'Build a quote for a customer' },
  { to: '/staff/quotations', icon: History, title: 'Quotation History', description: 'Search and reopen past quotes' },
  { to: '/staff/price-book', icon: BookOpen, title: 'Price Book', description: 'Reference and manage prices' },
  { to: '/staff/products', icon: Package, title: 'Products & Stock', description: 'View and restock inventory' },
  { to: '/staff/orders', icon: ClipboardList, title: 'Orders', description: 'Track customer orders' },
  { to: '/staff/customers', icon: Users, title: 'Customers', description: 'Find customers and their history' },
  { to: '/staff/reports', icon: BarChart3, title: 'Reports', description: 'Sales and quotation summaries' },
];

export default function StaffDashboard() {
  const { staff } = useStaffAuth();

  return (
    <StaffLayout title={`Welcome, ${staff?.full_name?.split(' ')[0] || 'Team'}`}>
      <div className="space-y-6">
        <Card className="border-gold/40 bg-primary text-primary-foreground overflow-hidden">
          <CardContent className="p-6">
            <span className="gold-pill">Staff Portal</span>
            <h2 className="font-serif text-2xl md:text-3xl text-gold mt-3">
              Quotations, inventory & customers
            </h2>
            <p className="text-sm text-primary-foreground/70 mt-2">
              Everything you need to serve customers quickly and professionally.
            </p>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {TILES.map((t) => (
            <Link key={t.to} to={t.to}>
              <Card className="h-full border-border hover:border-gold hover:shadow-lg transition-all">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="h-11 w-11 rounded-lg bg-primary text-gold flex items-center justify-center shrink-0">
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}

          <a href="/downloads/patrichias-store.apk" download>
            <Card className="h-full border-border hover:border-gold hover:shadow-lg transition-all">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="h-11 w-11 rounded-lg bg-primary text-gold flex items-center justify-center shrink-0">
                  <Download className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold">Download App</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">Install the store app on your phone</p>
                </div>
              </CardContent>
            </Card>
          </a>
        </div>
      </div>
    </StaffLayout>
  );
}