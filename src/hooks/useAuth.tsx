import { useState, useEffect, useRef, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'customer';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const profileRequestId = useRef(0);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  // Ignore stale profile requests when auth state changes quickly (for example,
  // during sign-in/sign-out or when the initial session is being restored).
  const loadProfile = async (userId: string) => {
    const requestId = ++profileRequestId.current;
    setIsLoading(true);
    const profileData = await fetchProfile(userId);

    if (requestId === profileRequestId.current) {
      setProfile(profileData);
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  useEffect(() => {
    let authEventReceived = false;

    // Register the listener before restoring the session so auth changes are
    // not missed. If an auth event arrives first, it takes precedence over the
    // potentially stale getSession() result.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        authEventReceived = true;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          void loadProfile(nextSession.user.id);
        } else {
          profileRequestId.current += 1;
          setProfile(null);
          setIsLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: restoredSession }, error }) => {
      if (authEventReceived) return;

      if (error) {
        console.error('Error restoring auth session:', error);
      }

      setSession(restoredSession);
      setUser(restoredSession?.user ?? null);

      if (restoredSession?.user) {
        void loadProfile(restoredSession.user.id);
      } else {
        setProfile(null);
        setIsLoading(false);
      }
    }).catch((error) => {
      if (authEventReceived) return;
      console.error('Error restoring auth session:', error);
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsLoading(false);
    });

    return () => {
      profileRequestId.current += 1;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setIsLoading(false);
      return { error };
    }

    setSession(data.session);
    setUser(data.user);

    // Resolve the user's database role before signIn() completes. This keeps
    // the admin route from rendering against a stale/null profile.
    await loadProfile(data.user.id);
    return { error: null };
  };

  const signOut = async () => {
    profileRequestId.current += 1;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsLoading(false);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isAdmin,
        isLoading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
