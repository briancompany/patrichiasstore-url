import { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, FileText, Trash2, Download, Printer, MessageCircle, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { downloadQuotation, printQuotation, whatsappQuotation, type QuotationPDFData } from '@/lib/quotation-pdf';

const PAGE_SIZE = 15;

interface QRow {
  id: string;
  quote_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: string;
  total: number;
  subtotal: number;
  discount: number;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
  staff_name: string | null;
}

export default function QuotationHistory() {
  const navigate = useNavigate();
  const { isLoading, isStaff } = useStaffAuth();
  const [rows, setRows] = useState<QRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isStaff) navigate('/staff/login', { replace: true });
  }, [isLoading, isStaff, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from('quotations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);
    if (search.trim()) {
      const s = `%${search.trim()}%`;
      q = q.or(`customer_name.ilike.${s},customer_phone.ilike.${s},quote_number.ilike.${s}`);
    }
    const { data, count } = await q;
    setRows((data as QRow[]) || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    if (isStaff) load();
  }, [isStaff, load]);

  const openPdf = async (row: QRow, action: 'print' | 'download' | 'whatsapp') => {
    const { data: items } = await supabase
      .from('quotation_items')
      .select('product_name,size,color,unit_price,quantity,line_total')
      .eq('quotation_id', row.id);
    const pdf: QuotationPDFData = { ...row, items: (items as QuotationPDFData['items']) || [] };
    if (action === 'print') printQuotation(pdf);
    else if (action === 'download') downloadQuotation(pdf);
    else whatsappQuotation(pdf);
  };

  const handleDelete = async (id: string, number: string) => {
    if (!confirm(`Delete quotation ${number}? This cannot be undone.`)) return;
    const { error } = await supabase.from('quotations').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Quotation deleted');
    load();
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  if (isLoading || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/staff" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-semibold">Quotations</h1>
          <Link to="/staff/quotations/new">
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> New</Button>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by customer, phone or quote number"
            value={search}
            onChange={(e) => { setPage(0); setSearch(e.target.value); }}
          />
        </div>

        {loading && <p className="text-center text-sm text-muted-foreground py-6">Loading…</p>}
        {!loading && rows.length === 0 && (
          <Card><CardContent className="p-8 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
            No quotations yet.
          </CardContent></Card>
        )}

        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{r.quote_number}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.status}</span>
                  </div>
                  <p className="text-sm mt-1">{r.customer_name} · {r.customer_phone}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()} · Ksh {r.total.toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  <Button variant="outline" size="sm" onClick={() => openPdf(r, 'print')}><Printer className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => openPdf(r, 'download')}><Download className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => openPdf(r, 'whatsapp')}><MessageCircle className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(r.id, r.quote_number)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </main>
    </div>
  );
}