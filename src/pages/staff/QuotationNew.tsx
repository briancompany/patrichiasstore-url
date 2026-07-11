import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { useGeneralProducts, usePricingChart, useSchoolsList } from '@/hooks/useProductCache';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Trash2, Plus, ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';
import { normalizePhone, isValidKePhone } from '@/lib/phone';
import { downloadQuotation, printQuotation, whatsappQuotation, type QuotationPDFData } from '@/lib/quotation-pdf';
import { Link } from 'react-router-dom';

interface Line {
  product_id?: string | null;
  product_name: string;
  size: string;
  color: string;
  unit_price: number;
  quantity: number;
}

export default function QuotationNew() {
  const navigate = useNavigate();
  const { staff, isLoading, isStaff } = useStaffAuth();
  const { products } = useGeneralProducts();
  const pricing = usePricingChart();
  const schools = useSchoolsList();

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('');
  const [items, setItems] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isLoading && !isStaff) navigate('/staff/login', { replace: true });
  }, [isLoading, isStaff, navigate]);

  const pricingOptions = useMemo(() => {
    const opts: { name: string; sizes: { size: string; price: number }[] }[] = [];
    Object.entries(pricing).forEach(([type, sizes]) => opts.push({ name: type, sizes }));
    return opts;
  }, [pricing]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 30);
  }, [search, products]);

  const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const addBlankLine = () =>
    setItems((p) => [...p, { product_name: '', size: '', color: '', unit_price: 0, quantity: 1 }]);

  const addProduct = (p: (typeof products)[number]) => {
    const firstSize = p.sizes?.[0];
    setItems((prev) => [
      ...prev,
      {
        product_id: p.id,
        product_name: p.name,
        size: firstSize?.size || '',
        color: '',
        unit_price: firstSize?.price || 0,
        quantity: 1,
      },
    ]);
  };

  const addPricing = (typeName: string, sz: { size: string; price: number }) => {
    setItems((prev) => [
      ...prev,
      { product_name: typeName, size: sz.size, color: '', unit_price: sz.price, quantity: 1 },
    ]);
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setItems((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const removeLine = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async (afterAction?: 'print' | 'whatsapp' | 'download') => {
    if (!customerName.trim()) return toast.error('Customer name required');
    if (!isValidKePhone(customerPhone)) return toast.error('Valid Kenyan phone required');
    if (items.length === 0) return toast.error('Add at least one item');
    if (items.some((i) => !i.product_name.trim() || i.quantity < 1 || i.unit_price < 0))
      return toast.error('Every item needs a name, price and quantity');

    setSaving(true);
    try {
      const phone = normalizePhone(customerPhone);
      // upsert customer
      let customerId: string | null = null;
      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();
      if (existing) {
        customerId = existing.id;
        await supabase
          .from('customers')
          .update({
            name: customerName.trim(),
            email: customerEmail.trim() || null,
          })
          .eq('id', existing.id);
      } else {
        const { data: inserted } = await supabase
          .from('customers')
          .insert({
            name: customerName.trim(),
            phone,
            email: customerEmail.trim() || null,
            created_by: staff!.user_id,
          })
          .select('id')
          .single();
        customerId = inserted?.id ?? null;
      }

      const { data: quote, error: qErr } = await supabase
        .from('quotations')
        .insert({
          customer_id: customerId,
          customer_name: customerName.trim(),
          customer_phone: phone,
          customer_email: customerEmail.trim() || null,
          staff_user_id: staff!.user_id,
          staff_name: staff!.full_name,
          status: 'draft',
          subtotal,
          discount,
          total,
          valid_until: validUntil || null,
          notes: notes.trim() || null,
        })
        .select('*')
        .single();

      if (qErr || !quote) throw qErr || new Error('Failed to save quotation');

      const rows = items.map((it) => ({
        quotation_id: quote.id,
        product_id: it.product_id ?? null,
        product_name: it.product_name.trim(),
        size: it.size || null,
        color: it.color || null,
        unit_price: it.unit_price,
        quantity: it.quantity,
        line_total: it.unit_price * it.quantity,
      }));
      const { error: iErr } = await supabase.from('quotation_items').insert(rows);
      if (iErr) throw iErr;

      toast.success(`Quotation ${quote.quote_number} saved`);

      const pdfData: QuotationPDFData = {
        quote_number: quote.quote_number,
        customer_name: quote.customer_name,
        customer_phone: quote.customer_phone,
        customer_email: quote.customer_email,
        staff_name: quote.staff_name,
        created_at: quote.created_at,
        valid_until: quote.valid_until,
        notes: quote.notes,
        subtotal: quote.subtotal,
        discount: quote.discount,
        total: quote.total,
        items: rows.map((r) => ({
          product_name: r.product_name,
          size: r.size,
          color: r.color,
          unit_price: r.unit_price,
          quantity: r.quantity,
          line_total: r.line_total,
        })),
      };
      if (afterAction === 'print') printQuotation(pdfData);
      else if (afterAction === 'download') downloadQuotation(pdfData);
      else if (afterAction === 'whatsapp') whatsappQuotation(pdfData);

      navigate('/staff/quotations');
    } catch (e) {
      console.error(e);
      toast.error((e as Error).message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !isStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted pb-32">
      <header className="bg-card border-b border-border sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/staff" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <h1 className="font-semibold">New Quotation</h1>
          <div className="w-16" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="font-semibold">Customer</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Full name</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Jane Doe" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="0712 345 678" />
              </div>
              <div>
                <Label>Email (optional)</Label>
                <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="jane@example.com" />
              </div>
              <div>
                <Label>Valid until (optional)</Label>
                <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Items</h2>
              <Button variant="outline" size="sm" onClick={addBlankLine}>
                <Plus className="h-4 w-4 mr-1" /> Custom line
              </Button>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Search products to add…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {filteredProducts.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addProduct(p)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    >
                      + {p.name} <span className="text-xs text-muted-foreground">Ksh {p.sizes?.[0]?.price ?? 0}</span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No matches</div>
                  )}
                </div>
              )}
              {pricingOptions.length > 0 && (
                <details className="border rounded-lg">
                  <summary className="px-3 py-2 text-sm cursor-pointer">Add from pricing chart</summary>
                  <div className="max-h-48 overflow-y-auto divide-y">
                    {pricingOptions.map((t) =>
                      t.sizes.map((sz) => (
                        <button
                          key={`${t.name}-${sz.size}`}
                          onClick={() => addPricing(t.name, sz)}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                        >
                          + {t.name} — {sz.size} <span className="text-xs text-muted-foreground">Ksh {sz.price}</span>
                        </button>
                      )),
                    )}
                  </div>
                </details>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">No items yet — search above or add a custom line.</p>
              )}
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-lg p-2">
                  <div className="col-span-12 sm:col-span-4">
                    <Label className="text-xs">Item</Label>
                    <Input value={it.product_name} onChange={(e) => updateLine(i, { product_name: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">Size</Label>
                    <Input value={it.size} onChange={(e) => updateLine(i, { size: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <Label className="text-xs">Color</Label>
                    <Input value={it.color} onChange={(e) => updateLine(i, { color: e.target.value })} />
                  </div>
                  <div className="col-span-4 sm:col-span-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateLine(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })}
                    />
                  </div>
                  <div className="col-span-8 sm:col-span-2">
                    <Label className="text-xs">Unit price (Ksh)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={it.unit_price}
                      onChange={(e) => updateLine(i, { unit_price: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-1 flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => removeLine(i)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Notes for customer</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Delivery info, terms…" />
              </div>
              <div>
                <Label>Discount (Ksh)</Label>
                <Input
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(Math.max(0, parseInt(e.target.value) || 0))}
                />
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex justify-between"><span>Subtotal</span><span>Ksh {subtotal.toLocaleString()}</span></div>
                  {discount > 0 && <div className="flex justify-between text-destructive"><span>Discount</span><span>- Ksh {discount.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-bold text-lg text-primary"><span>Total</span><span>Ksh {total.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <div className="fixed bottom-0 inset-x-0 bg-card border-t p-3 z-30">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-end">
          <Button variant="outline" disabled={saving} onClick={() => handleSave()}>
            <Save className="h-4 w-4 mr-1" /> Save
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => handleSave('print')}>Save & Print</Button>
          <Button variant="outline" disabled={saving} onClick={() => handleSave('download')}>Save & Download</Button>
          <Button disabled={saving} onClick={() => handleSave('whatsapp')}>Save & Send WhatsApp</Button>
        </div>
      </div>
    </div>
  );
}