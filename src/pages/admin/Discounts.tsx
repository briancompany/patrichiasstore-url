import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Tag, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Discount {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  minPurchase: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt: string | null;
}

export default function AdminDiscounts() {
  const [discounts, setDiscounts] = useState<Discount[]>([
    {
      id: '1',
      code: 'BACK2SCHOOL',
      type: 'percentage',
      value: 10,
      minPurchase: 1000,
      maxUses: 100,
      usedCount: 23,
      active: true,
      expiresAt: '2026-02-28',
    },
    {
      id: '2',
      code: 'NEWCUSTOMER',
      type: 'fixed',
      value: 200,
      minPurchase: 500,
      maxUses: 50,
      usedCount: 12,
      active: true,
      expiresAt: null,
    },
  ]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 10,
    minPurchase: 0,
    maxUses: 100,
    expiresAt: '',
  });

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Simulate API call - in production this would save to database
    setTimeout(() => {
      const newDiscount: Discount = {
        id: Date.now().toString(),
        code: formData.code.toUpperCase(),
        type: formData.type,
        value: formData.value,
        minPurchase: formData.minPurchase,
        maxUses: formData.maxUses,
        usedCount: 0,
        active: true,
        expiresAt: formData.expiresAt || null,
      };

      setDiscounts([...discounts, newDiscount]);
      toast.success('Discount code created');
      setDialogOpen(false);
      setFormData({
        code: '',
        type: 'percentage',
        value: 10,
        minPurchase: 0,
        maxUses: 100,
        expiresAt: '',
      });
      setIsSaving(false);
    }, 500);
  };

  const toggleDiscount = (id: string) => {
    setDiscounts(
      discounts.map((d) => (d.id === id ? { ...d, active: !d.active } : d))
    );
    toast.success('Discount status updated');
  };

  const deleteDiscount = (id: string) => {
    setDiscounts(discounts.filter((d) => d.id !== id));
    toast.success('Discount deleted');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Discount
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Discount Code</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Discount Code</Label>
                  <div className="flex gap-2">
                    <Input
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({ ...formData, code: e.target.value.toUpperCase() })
                      }
                      placeholder="e.g., SAVE10"
                      required
                    />
                    <Button type="button" variant="outline" onClick={generateCode}>
                      Generate
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, type: value as 'percentage' | 'fixed' })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount (Ksh)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Value</Label>
                    <Input
                      type="number"
                      value={formData.value}
                      onChange={(e) =>
                        setFormData({ ...formData, value: parseInt(e.target.value) || 0 })
                      }
                      min={1}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Min. Purchase (Ksh)</Label>
                    <Input
                      type="number"
                      value={formData.minPurchase}
                      onChange={(e) =>
                        setFormData({ ...formData, minPurchase: parseInt(e.target.value) || 0 })
                      }
                      min={0}
                    />
                  </div>
                  <div>
                    <Label>Max Uses</Label>
                    <Input
                      type="number"
                      value={formData.maxUses}
                      onChange={(e) =>
                        setFormData({ ...formData, maxUses: parseInt(e.target.value) || 1 })
                      }
                      min={1}
                    />
                  </div>
                </div>

                <div>
                  <Label>Expires On (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create
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
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Discount
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {discounts.map((discount) => (
              <Card key={discount.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                        <Tag className="h-6 w-6 text-secondary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-mono font-bold text-lg">{discount.code}</h3>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => copyCode(discount.code)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {discount.type === 'percentage'
                            ? `${discount.value}% off`
                            : `Ksh ${discount.value} off`}
                          {discount.minPurchase > 0 &&
                            ` • Min. Ksh ${discount.minPurchase.toLocaleString()}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Used {discount.usedCount}/{discount.maxUses} times
                          {discount.expiresAt && ` • Expires ${discount.expiresAt}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={discount.active}
                          onCheckedChange={() => toggleDiscount(discount.id)}
                        />
                        <Badge className={discount.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {discount.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteDiscount(discount.id)}
                      >
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
