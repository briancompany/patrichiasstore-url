import { StaffLayout } from '@/components/layout/StaffLayout';
import { Card, CardContent } from '@/components/ui/card';
import { useStaffAuth } from '@/hooks/useStaffAuth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { LogOut, Shield, User } from 'lucide-react';

export default function Settings() {
  const { staff } = useStaffAuth();
  const navigate = useNavigate();
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/staff/login', { replace: true });
  };
  return (
    <StaffLayout title="Settings">
      <div className="max-w-2xl space-y-4">
        <Card className="border-gold/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-navy">
              <User className="h-4 w-4 text-gold" />
              <h3 className="font-serif text-lg">Your Profile</h3>
            </div>
            <div className="gold-divider" />
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Full name:</span> {staff?.full_name}</div>
              <div><span className="text-muted-foreground">Email:</span> {staff?.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {staff?.phone}</div>
              <div><span className="text-muted-foreground">Role:</span> {staff?.role}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gold/30">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-navy">
              <Shield className="h-4 w-4 text-gold" />
              <h3 className="font-serif text-lg">Session</h3>
            </div>
            <div className="gold-divider" />
            <p className="text-sm text-muted-foreground">
              You stay signed in on this device until you sign out or uninstall the app.
            </p>
            <Button variant="outline" onClick={signOut} className="btn-gold-outline">
              <LogOut className="h-4 w-4 mr-1" /> Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </StaffLayout>
  );
}