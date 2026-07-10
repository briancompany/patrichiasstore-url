import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, MessageCircle, Shield, Power } from 'lucide-react';
import { normalizePhone, isValidKePhone } from '@/lib/phone';

const LIVE_LOGIN_URL = 'https://patrichiasstore-url.vercel.app/staff/login';

interface StaffRow {
  user_id: string;
  email: string;
  phone: string;
  full_name: string;
  role: 'admin' | 'quotation_staff';
  is_active: boolean;
  created_at: string;
}

export default function AdminStaff() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    role: 'quotation_staff' as 'quotation_staff' | 'admin',
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_users' as never)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as StaffRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async () => {
    const full_name = form.full_name.trim();
    const email = form.email.trim().toLowerCase();
    if (!full_name || !email) {
      toast.error('Name and email are required');
      return;
    }
    if (!isValidKePhone(form.phone)) {
      toast.error('Enter a valid Kenyan phone number');
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff-account', {
        body: {
          full_name,
          email,
          phone: normalizePhone(form.phone),
          role: form.role,
        },
      });
      if (error || !data?.ok) {
        toast.error(data?.error || error?.message || 'Could not create staff');
        return;
      }
      toast.success('Staff account created');
      setOpen(false);
      setForm({ full_name: '', email: '', phone: '', role: 'quotation_staff' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: StaffRow) => {
    const { data, error } = await supabase.functions.invoke('deactivate-staff-account', {
      body: { user_id: row.user_id, active: !row.is_active },
    });
    if (error || !data?.ok) {
      toast.error(data?.error || error?.message || 'Failed');
      return;
    }
    toast.success(row.is_active ? 'Staff deactivated' : 'Staff reactivated');
    load();
  };

  const whatsappInvite = (row: StaffRow) => {
    const msg =
      `Hello ${row.full_name}, your Patrichia's Store staff account is ready.\n\n` +
      `Login here: ${LIVE_LOGIN_URL}\n` +
      `Email: ${row.email}\n` +
      `Phone: ${row.phone}`;
    window.open(`https://wa.me/${row.phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Staff</h1>
            <p className="text-muted-foreground">
              Create staff accounts and share login details via WhatsApp
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" /> Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add new staff</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Full name</Label>
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jane@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="0712 345 678"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(v) => setForm({ ...form, role: v as never })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quotation_staff">Quotation Staff</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={saving}>
                  {saving ? 'Creating…' : 'Create staff'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
          </div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No staff yet. Add your first staff member above.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <Card key={row.user_id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                        {row.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold">{row.full_name}</p>
                          <Badge variant={row.role === 'admin' ? 'default' : 'secondary'}>
                            {row.role === 'admin' ? (
                              <><Shield className="h-3 w-3 mr-1" /> Admin</>
                            ) : (
                              'Quotation Staff'
                            )}
                          </Badge>
                          {!row.is_active && <Badge variant="destructive">Inactive</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{row.email}</p>
                        <p className="text-xs text-muted-foreground">+{row.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => whatsappInvite(row)}
                        className="text-whatsapp border-whatsapp/40 hover:bg-whatsapp/10"
                      >
                        <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActive(row)}
                      >
                        <Power className="h-4 w-4 mr-1" />
                        {row.is_active ? 'Deactivate' : 'Activate'}
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