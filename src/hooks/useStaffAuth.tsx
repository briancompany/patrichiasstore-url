import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface StaffProfile {
  user_id: string;
  email: string;
  phone: string;
  full_name: string;
  role: 'admin' | 'quotation_staff';
  is_active: boolean;
}

export function useStaffAuth() {
  const [staff, setStaff] = useState<StaffProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async (uid: string | undefined) => {
      if (!uid) {
        if (mounted) {
          setStaff(null);
          setIsLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from('staff_users' as never)
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();
      if (mounted) {
        setStaff((data as StaffProfile) || null);
        setIsLoading(false);
      }
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user?.id);
    });

    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id));

    return () => sub.subscription.unsubscribe();
  }, []);

  return { staff, isLoading, isStaff: !!staff && staff.is_active };
}