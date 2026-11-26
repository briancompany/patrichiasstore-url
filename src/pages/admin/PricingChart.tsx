import { useState, useEffect, useRef } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Save, Tag, Upload, Download, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface PriceEntry { id: string; uniform_type: string; size: string; price: number; }
interface ImportRow { uniform_type: string; size: string; price: number; row: number; }
interface InvalidRow { row: number; reason: string; }

const knownTypes = [
  { value: 'tshirt', label: 'T-Shirt' }, { value: 'shirts', label: 'Shirts' },
  { value: 'shirts_york', label: 'Shirts – York' }, { value: 'shirts_normal_plain', label: 'Shirts – Normal (Plain)' },
  { value: 't_shirts_kids', label: 'T-Shirts – Kids' }, { value: 't_shirts_adults', label: 'T-Shirts – Adults' },
  { value: 'polo_shirts', label: 'Polo Shirts' }, { value: 'long_sleeve_shirts_plain', label: 'Long Sleeve Shirts – Plain' },
  { value: 'long_sleeve_shirts_stripes', label: 'Long Sleeve Shirts – Stripes' },
  { value: 'tracksuit', label: 'Tracksuits' }, { value: 'socks', label: 'Socks' },
  { value: 'shorts', label: 'Shorts' }, { value: 'shorts_summit', label: 'Shorts – Summit' }, { value: 'shorts_grey', label: 'Shorts – Grey' },
  { value: 'trousers', label: 'Trousers' }, { value: 'trousers_primary_school_summit', label: 'Trousers – Primary School – Summit' },
  { value: 'trousers_primary_school_grey', label: 'Trousers – Primary School – Grey' },
  { value: 'trousers_high_school_summit', label: 'Trousers – High School – Summit' },
  { value: 'trousers_high_school_grey', label: 'Trousers – High School – Grey' },
  { value: 'skirt', label: 'Skirt' }, { value: 'sweater', label: 'Sweater' },
  { value: 'tie', label: 'Tie' }, { value: 'dress', label: 'Dress' },
  { value: 'fleece_jacket', label: 'Fleeze' }, { value: 'blazers', label: 'Blazers' },
  { value: 'lab_coats', label: 'Lab Coats' }, { value: 'scrubs', label: 'Scrubs' }, { value: 'other', label: 'Other' },
];

const TYPE_ALIASES: Record<string, string> = {
  fleeze: 'fleece_jacket',
  jumper: 'fleece_jacket',
  jumpers: 'fleece_jacket',
  tracksuits: 'tracksuit',
  'lab coat': 'lab_coats',
  'lab coats': 'lab_coats',
  dresses: 'dress',
  dress: 'dress',
  'track suit': 'tracksuit',
  tracksuit: 'tracksuit',
  't-shirt': 'tshirt',
  't shirts': 'tshirt',
  't_shirt': 'tshirt',
  't_shirts': 'tshirt',
  labcoat: 'lab_coats',
  lab_coat: 'lab_coats',
  blazer: 'blazers',
  polo: 'polo_shirts',
};

const normaliseType = (value: string) => {
  const cleaned = value.trim().toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ');
  const normalised = cleaned.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const alias = TYPE_ALIASES[cleaned] || TYPE_ALIASES[normalised];
  if (alias) return alias;
  const known = knownTypes.find(t => t.value === cleaned || t.label.toLowerCase() === cleaned || t.value === normalised);
  return known?.value || normalised;
};

const isSupportedType = (type: string) => knownTypes.some(t => t.value === type);

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let value = '', quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; }
    else value += char;
  }
  cells.push(value.trim());
  return cells;
}

export default function PricingChart() {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newEntry, setNewEntry] = useState({ uniform_type: '', size: '', price: '' });
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { void fetchPrices(); }, []);

  const fetchPrices = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('pricing_chart').select('*').order('uniform_type').order('size');
    if (error) toast.error('Could not load price charts');
    else setPrices((data || []) as PriceEntry[]);
    setIsLoading(false);
  };

  const handleAddPrice = async () => {
    const type = normaliseType(newEntry.uniform_type);
    const size = newEntry.size.trim();
    const price = Number(newEntry.price);
    if (!type || !size || !newEntry.price.trim()) { toast.error('Enter a product category, size and price'); return; }
    if (!isSupportedType(type)) { toast.error('Choose a supported uniform category from the current price list'); return; }
    if (!Number.isSafeInteger(price) || price <= 0) { toast.error('Enter a valid whole-number price'); return; }
    const { error } = await supabase.from('pricing_chart').upsert({ uniform_type: type, size, price }, { onConflict: 'uniform_type,size' });
    if (error) { toast.error(error.message || 'Could not save price'); return; }
    toast.success('Size and price saved');
    setNewEntry({ uniform_type: '', size: '', price: '' });
    await fetchPrices();
  };

  const handleDeletePrice = async (id: string) => {
    const { error } = await supabase.from('pricing_chart').delete().eq('id', id);
    if (error) toast.error(error.message || 'Could not delete entry');
    else { toast.success('Price entry deleted'); setPrices(current => current.filter(p => p.id !== id)); }
  };

  const handleUpdatePrice = async (id: string, raw: string, oldPrice: number) => {
    const price = Number(raw);
    if (!Number.isSafeInteger(price) || price <= 0) { toast.error('Price must be a positive whole number'); return; }
    if (price === oldPrice) return;
    const { error } = await supabase.from('pricing_chart').update({ price }).eq('id', id);
    if (error) toast.error(error.message || 'Could not update price');
    else { toast.success('Price updated'); setPrices(current => current.map(p => p.id === id ? { ...p, price } : p)); }
  };

  const downloadTemplate = () => {
    const csv = 'uniform_type,size,price\nsweater,S,500\nsweater,M,550\nfleece_jacket,20,450\nfleece_jacket,22,500\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = 'patrichia-size-price-template.csv'; link.click(); URL.revokeObjectURL(url);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { toast.error('For now, upload a CSV file. You can save an Excel sheet as CSV.'); return; }
    const raw = await file.text();
    const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (lines.length < 2) { toast.error('The file needs a header and at least one data row'); return; }
    const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
    const typeIndex = headers.findIndex(h => ['uniform_type', 'product_type', 'category', 'product'].includes(h));
    const sizeIndex = headers.indexOf('size');
    const priceIndex = headers.findIndex(h => ['price', 'price_ksh', 'amount'].includes(h));
    if ([typeIndex, sizeIndex, priceIndex].some(i => i < 0)) {
      toast.error('Required columns: uniform_type, size, price'); return;
    }
    const parsed: ImportRow[] = [], invalid: InvalidRow[] = [];
    const seen = new Set<string>();
    lines.slice(1).forEach((line, index) => {
      const cells = parseCsvLine(line);
      if (cells.length !== headers.length) {
        invalid.push({ row: index + 2, reason: 'Unexpected number of columns. Quote prices that contain commas, for example "1,000".' });
        return;
      }
      const typeRaw = cells[typeIndex] || '', size = (cells[sizeIndex] || '').trim();
      const type = normaliseType(typeRaw);
      const priceRaw = (cells[priceIndex] || '').replace(/[\s,]/g, '');
      const price = Number(priceRaw);
      const row = index + 2;
      if (!type || !size || !priceRaw || !Number.isSafeInteger(price) || price <= 0) {
        invalid.push({ row, reason: 'Missing category/size or invalid positive whole-number price' }); return;
      }
      if (!isSupportedType(type)) {
        invalid.push({ row, reason: `Unsupported uniform category: ${typeRaw}. Use a category from the supported list.` }); return;
      }
      const key = type + '::' + size.toLowerCase();
      if (seen.has(key)) { invalid.push({ row, reason: 'Duplicate category and size in this file' }); return; }
      seen.add(key); parsed.push({ uniform_type: type, size, price, row });
    });
    setFileName(file.name); setImportRows(parsed); setInvalidRows(invalid);
    if (!parsed.length) toast.error('No valid rows found in this file');
  };

  const importPrices = async () => {
    if (!importRows.length || invalidRows.length) { toast.error('Fix invalid rows before importing'); return; }
    setIsSaving(true);
    const payload = importRows.map(({ uniform_type, size, price }) => ({ uniform_type, size, price }));
    const { error } = await supabase.from('pricing_chart').upsert(payload, { onConflict: 'uniform_type,size' });
    setIsSaving(false);
    if (error) { toast.error(error.message || 'Bulk import failed; no success is assumed'); return; }
    toast.success(`Imported ${payload.length} size and price entries`);
    setImportRows([]); setInvalidRows([]); setFileName('');
    if (fileRef.current) fileRef.current.value = '';
    await fetchPrices();
  };

  const grouped = prices.reduce((acc, entry) => {
    (acc[entry.uniform_type] ||= []).push(entry);
    return acc;
  }, {} as Record<string, PriceEntry[]>);
  const labelFor = (type: string) => knownTypes.find(t => t.value === type)?.label || type.replace(/_/g, ' ');

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Size & Price Charts</h1>
          <p className="text-muted-foreground">Manage reusable size and price lists by product category. Sizes can be letters, numbers or custom labels.</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" /> Bulk upload price charts</CardTitle>
            <CardDescription>Upload one CSV containing multiple categories. Required columns: uniform_type, size, price. Existing matching entries will be updated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="h-4 w-4 mr-2" />Download CSV template</Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><FileSpreadsheet className="h-4 w-4 mr-2" />Choose CSV file</Button>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => void handleFile(e.target.files?.[0])} />
            </div>
            {fileName && <p className="text-sm text-muted-foreground">Selected: {fileName}</p>}
            {importRows.length > 0 && <div className="space-y-3 rounded-lg border p-3">
              <div className="flex flex-wrap justify-between gap-2"><p className="font-medium">Import preview: {importRows.length} valid rows</p><p className="text-sm text-muted-foreground">{new Set(importRows.map(r => r.uniform_type)).size} categories</p></div>
              <div className="max-h-64 overflow-auto"><Table><TableHeader><TableRow><TableHead>Category</TableHead><TableHead>Size</TableHead><TableHead>Price (KSh)</TableHead></TableRow></TableHeader><TableBody>{importRows.slice(0, 100).map(r => <TableRow key={r.row}><TableCell>{labelFor(r.uniform_type)}</TableCell><TableCell>{r.size}</TableCell><TableCell>{r.price.toLocaleString('en-KE')}</TableCell></TableRow>)}</TableBody></Table></div>
              {importRows.length > 100 && <p className="text-xs text-muted-foreground">Showing first 100 rows of {importRows.length}.</p>}
              {invalidRows.length > 0 && <div className="text-sm text-destructive space-y-1"><p className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" />{invalidRows.length} invalid row(s). Correct the file and upload it again.</p>{invalidRows.slice(0, 8).map(r => <p key={r.row}>Row {r.row}: {r.reason}</p>)}</div>}
              <Button onClick={() => void importPrices()} disabled={isSaving || invalidRows.length > 0}><Upload className="h-4 w-4 mr-2" />{isSaving ? 'Importing…' : `Import ${importRows.length} entries`}</Button>
            </div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Add or update one size</CardTitle><CardDescription>Enter any size label exactly as you want it displayed, such as S, M, 20, 22 or 10–12 Years.</CardDescription></CardHeader>
          <CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Product category</Label><Input list="uniform-type-options" placeholder="e.g. sweater, fleece jacket" value={newEntry.uniform_type} onChange={e => setNewEntry({ ...newEntry, uniform_type: e.target.value })} /><datalist id="uniform-type-options">{knownTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</datalist></div>
            <div className="space-y-2"><Label>Size label</Label><Input placeholder="e.g. S, 22, 10-12 Years" value={newEntry.size} onChange={e => setNewEntry({ ...newEntry, size: e.target.value })} /></div>
            <div className="space-y-2"><Label>Price (KSh)</Label><Input type="number" min="1" step="1" placeholder="e.g. 800" value={newEntry.price} onChange={e => setNewEntry({ ...newEntry, price: e.target.value })} /></div>
            <div className="md:col-span-3"><Button onClick={() => void handleAddPrice()}><Save className="h-4 w-4 mr-2" />Save size & price</Button></div>
          </div></CardContent>
        </Card>

        {isLoading ? <div className="flex items-center justify-center h-48"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div> :
          prices.length === 0 ? <Card><CardContent className="py-12 text-center"><Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><h3 className="font-semibold">No price entries yet</h3><p className="text-muted-foreground">Add entries manually or import a CSV file.</p></CardContent></Card> :
          <div className="grid gap-5">{Object.entries(grouped).map(([type, entries]) => <Card key={type}><CardHeader><CardTitle>{labelFor(type)}</CardTitle><CardDescription>{entries.length} size option(s)</CardDescription></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Size</TableHead><TableHead>Price (KSh)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{entries.map(entry => <TableRow key={entry.id}><TableCell className="font-medium">{entry.size}</TableCell><TableCell><Input type="number" min="1" step="1" defaultValue={entry.price} className="w-32" onBlur={e => void handleUpdatePrice(entry.id, e.target.value, entry.price)} /></TableCell><TableCell className="text-right"><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete price entry?</AlertDialogTitle><AlertDialogDescription>This removes this category and size from the shared chart. Products using the category may no longer offer this size.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void handleDeletePrice(entry.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>)}</div>}
      </div>
    </AdminLayout>
  );
}
