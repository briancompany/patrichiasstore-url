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

export default function StaffLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already signed in, go straight to staff dashboard
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/staff', { replace: true });
    });
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
      const { data, error } = await supabase.functions.invoke('staff-login', {
        body: { email: cleanEmail, phone: normalizePhone(phone) },
      });
      if (error || !data?.ok || !data?.token_hash) {
        toast.error(data?.error || error?.message || 'Login failed');
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