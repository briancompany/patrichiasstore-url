import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Search, Users, MessageCircle } from 'lucide-react';

const PAGE_SIZE = 20;

interface CRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  created_at: string;
}

export default function StaffCustomers() {
  const navigate = useNavigate();
  const { isLoading, isStaff } = useStaffAuth();
  const [rows, setRows] = useState<CRow[]>([]);
  const [page, setPage] = useState(0);
  const [count, setCount] = useState(0);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !isStaff) navigate('/staff/login', { replace: true });
  }, [isLoading, isStaff, navigate]);

  const load = useCallback(async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase.from('customers').select('id,name,phone,email,created_at', { count: 'exact' }).order('created_at', { ascending: false }).range(from, to);
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`name.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
    }
    const { data, count } = await q;
    setRows((data as CRow[]) || []);
    setCount(count || 0);
  }, [page, search]);

  useEffect(() => { if (isStaff) load(); }, [isStaff, load]);

  if (isLoading || !isStaff) return null;

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/staff" className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Back</Link>
          <h1 className="font-semibold">Customers</h1>
          <div className="w-16" />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, phone or email" value={search} onChange={(e) => { setPage(0); setSearch(e.target.value); }} />
        </div>
        {rows.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-2 opacity-40" /> No customers yet.
          </CardContent></Card>
        )}
        {rows.map((c) => {
          const phone = c.phone.replace(/[^0-9]/g, '');
          return (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-muted-foreground">{c.phone}{c.email ? ` · ${c.email}` : ''}</p>
                </div>
                <a href={`https://wa.me/${phone.startsWith('254') ? phone : '254' + phone.replace(/^0/, '')}`} target="_blank" rel="noopener">
                  <Button variant="outline" size="sm"><MessageCircle className="h-4 w-4" /></Button>
                </a>
              </CardContent>
            </Card>
          );
        })}
        {count > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </main>
    </div>
  );
}