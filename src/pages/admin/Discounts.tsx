import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Tag, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Discount {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  discount_amount: number;
  min_order_amount: number;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
}

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    minPurchase: 0,
    maxUses: 100,
    expiresAt: '',
    description: '',
  });

  useEffect(() => { fetchDiscounts(); }, []);

  const fetchDiscounts = async () => {
    const { data } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    setDiscounts(data || []);
    setLoading(false);
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const { error } = await supabase.from('discount_codes').insert({
      code: formData.code.toUpperCase(),
      description: formData.description || null,
      discount_percent: formData.type === 'percentage' ? formData.value : 0,
      discount_amount: formData.type === 'fixed' ? formData.value : 0,
      min_order_amount: formData.minPurchase,
      max_uses: formData.maxUses || null,
      expires_at: formData.expiresAt ? new Date(formData.expiresAt).toISOString() : null,
    });

    if (error) {
      toast.error(error.code === '23505' ? 'Code already exists' : 'Failed to create discount');
    } else {
      toast.success('Discount code created');
      setDialogOpen(false);
      setFormData({ code: '', type: 'percentage', value: 10, minPurchase: 0, maxUses: 100, expiresAt: '', description: '' });
      fetchDiscounts();
    }
    setIsSaving(false);
  };

  const toggleDiscount = async (id: string, active: boolean) => {
    await supabase.from('discount_codes').update({ is_active: !active }).eq('id', id);
    toast.success('Status updated');
    fetchDiscounts();
  };

  const deleteDiscount = async (id: string) => {
    await supabase.from('discount_codes').delete().eq('id', id);
    toast.success('Discount deleted');
    fetchDiscounts();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Discount Codes</h1>
            <p className="text-muted-foreground">Create and manage promotional discounts</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Create Discount</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Discount Code</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Discount Code</Label>
                  <div className="flex gap-2">
                    <Input value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="e.g., SAVE10" required />
                    <Button type="button" variant="outline" onClick={generateCode}>Generate</Button>
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Back to school discount" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (Ksh)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input type="number" value={formData.value} onChange={(e) => setFormData({ ...formData, value: parseInt(e.target.value) || 0 })} min={1} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min. Purchase (Ksh)</Label>
                    <Input type="number" value={formData.minPurchase} onChange={(e) => setFormData({ ...formData, minPurchase: parseInt(e.target.value) || 0 })} min={0} />
                  </div>
                  <div>
                    <Label>Max Uses</Label>
                    <Input type="number" value={formData.maxUses} onChange={(e) => setFormData({ ...formData, maxUses: parseInt(e.target.value) || 1 })} min={1} />
                  </div>
                </div>
                <div>
                  <Label>Expires On (Optional)</Label>
                  <Input type="date" value={formData.expiresAt} onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })} />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {discounts.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Tag className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No discount codes</h3>
              <p className="text-muted-foreground mb-4">Create promotional codes for your customers</p>
              <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Create Discount</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {discounts.map((d) => (
              <Card key={d.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <Tag className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-lg">{d.code}</h3>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyCode(d.code)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {d.discount_percent > 0 ? `${d.discount_percent}% off` : `Ksh ${d.discount_amount} off`}
                          {d.min_order_amount > 0 && ` • Min. Ksh ${d.min_order_amount.toLocaleString()}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Used {d.current_uses}{d.max_uses ? `/${d.max_uses}` : ''} times
                          {d.expires_at && ` • Expires ${new Date(d.expires_at).toLocaleDateString()}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={d.is_active} onCheckedChange={() => toggleDiscount(d.id, d.is_active)} />
                        <Badge className={d.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'}>
                          {d.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteDiscount(d.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
