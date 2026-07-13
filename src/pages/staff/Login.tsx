import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { normalizePhone, isValidKePhone } from '@/lib/phone';
import storeLogo from '@/assets/logo-with-patrichia.png';

const SUPABASE_URL = 'https://jkdxlbkckpwzmhdaoaoo.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprZHhsYmtja3B3em1oZGFvYW9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0NzI2MDcsImV4cCI6MjA4NDA0ODYwN30.u7hEkXp0wsNBm8dGzMhq1AsPCdMWdte1_6PziiLFyOI';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Only redirect if session belongs to an active staff user.
    // An admin session (non-staff) must NOT be bounced away from this page.
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) return;
      const { data: staffRow } = await supabase
        .from('staff_users')
        .select('user_id,is_active')
        .eq('user_id', uid)
        .maybeSingle();
      if (staffRow?.is_active) navigate('/staff', { replace: true });
    })();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !phone) {
      toast.error('Enter your email and phone');
      return;
    }
    if (!isValidKePhone(phone)) {
      toast.error('Enter a valid Kenyan phone number');
      return;
    }
    setLoading(true);
    try {
      // Use direct fetch so we can read the JSON error body on non-2xx responses
      // (supabase.functions.invoke swallows the body into a generic error).
      const res = await fetch(`${SUPABASE_URL}/functions/v1/staff-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ email: cleanEmail, phone: normalizePhone(phone) }),
      });
      const data = await res.json().catch(() => ({} as { ok?: boolean; token_hash?: string; error?: string }));
      if (!res.ok || !data?.ok || !data?.token_hash) {
        const msg =
          data?.error ||
          (res.status === 401
            ? 'Invalid email or phone. Contact your administrator.'
            : res.status === 429
            ? 'Too many attempts. Please wait a minute and try again.'
            : 'Login failed. Please try again.');
        toast.error(msg);
        return;
      }
      const { error: otpErr } = await supabase.auth.verifyOtp({
        type: 'magiclink',
        token_hash: data.token_hash,
      });
      if (otpErr) {
        toast.error(otpErr.message || 'Could not complete login');
        return;
      }
      toast.success('Welcome back');
      navigate('/staff', { replace: true });
    } catch (err) {
      toast.error((err as Error)?.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <img src={storeLogo} alt="Patrichia's Store" className="h-16 w-16 mx-auto object-contain" />
          <CardTitle className="text-2xl">Staff Sign In</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use the email and phone number your administrator gave you.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0712 345 678"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}