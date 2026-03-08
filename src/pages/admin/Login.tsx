import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft, Shield, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import storeLogo from '@/assets/logo-with-patrichia.png';
import { rateLimit, rateLimitTimeRemaining, logAuditEvent, sanitizeText, detectSuspiciousActivity } from '@/lib/security';

const ADMIN_EMAIL = 'brianmuia777@gmail.com';

export default function AdminLogin() {
  const navigate = useNavigate();
  const { signIn, isAdmin, user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTimer, setLockoutTimer] = useState(0);

  const [loginData, setLoginData] = useState({ email: '', password: '' });

  // Redirect if already logged in as admin
  useEffect(() => {
    if (!authLoading && user && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // Lockout timer countdown
  useEffect(() => {
    if (lockoutTimer > 0) {
      const timer = setTimeout(() => setLockoutTimer(lockoutTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (lockoutTimer === 0 && isLocked) {
      setIsLocked(false);
      setFailedAttempts(0);
    }
  }, [lockoutTimer, isLocked]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      toast.error(`Account locked. Try again in ${lockoutTimer} seconds.`);
      return;
    }

    // Rate limit: max 5 login attempts per 2 minutes
    if (!rateLimit('admin-login', 5, 120_000)) {
      const remaining = rateLimitTimeRemaining('admin-login', 120_000);
      toast.error(`Too many login attempts. Wait ${remaining}s.`);
      logAuditEvent('LOGIN_RATE_LIMITED', `Login rate limited`, 'warning');
      return;
    }

    const sanitizedEmail = sanitizeText(loginData.email).toLowerCase();

    // Detect suspicious rapid attempts
    if (detectSuspiciousActivity('login-attempt', 8, 60_000)) {
      logAuditEvent('SUSPICIOUS_LOGIN', `Rapid login attempts detected for: ${sanitizedEmail}`, 'critical');
    }

    // Check if email matches admin email
    if (sanitizedEmail !== ADMIN_EMAIL.toLowerCase()) {
      setFailedAttempts(prev => prev + 1);
      logAuditEvent('LOGIN_DENIED', `Unauthorized admin login attempt: ${sanitizedEmail}`, 'warning');
      
      // Lock after 3 failed attempts
      if (failedAttempts >= 2) {
        setIsLocked(true);
        setLockoutTimer(60);
        logAuditEvent('ACCOUNT_LOCKED', `Admin login locked after 3 failed attempts`, 'critical');
        toast.error('Too many failed attempts. Account temporarily locked.');
        return;
      }
      
      toast.error('Access denied. Only authorized administrators can log in.');
      return;
    }

    setIsLoading(true);

    const { error } = await signIn(loginData.email, loginData.password);

    if (error) {
      setFailedAttempts(prev => prev + 1);
      
      // Lock after 3 failed attempts
      if (failedAttempts >= 2) {
        setIsLocked(true);
        setLockoutTimer(60);
        toast.error('Too many failed attempts. Account temporarily locked.');
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    toast.success('Logged in successfully!');
    setFailedAttempts(0);
    navigate('/admin/dashboard');
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-primary hover:text-primary/80 mb-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Store
          </Link>
          <div className="flex items-center justify-center gap-2 mb-2">
            <img src={storeLogo} alt="Patrichia's Store" className="h-12 w-12 object-contain" />
            <h1 className="text-2xl font-bold text-foreground">Patrichia's Store</h1>
          </div>
          <p className="text-muted-foreground">Admin Portal</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Admin Login
            </CardTitle>
            <CardDescription>Sign in to access the admin dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            {isLocked ? (
              <div className="text-center py-6">
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <h3 className="font-semibold text-lg text-destructive mb-2">Account Temporarily Locked</h3>
                <p className="text-muted-foreground mb-4">
                  Too many failed login attempts. Please try again in:
                </p>
                <div className="text-3xl font-bold text-destructive">{lockoutTimer}s</div>
              </div>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    placeholder="admin@example.com"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                {failedAttempts > 0 && (
                  <p className="text-sm text-destructive">
                    {3 - failedAttempts} attempts remaining before lockout
                  </p>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Sign In
                </Button>

                <div className="text-center pt-4 border-t">
                  <p className="text-xs text-muted-foreground">
                    <Shield className="h-3 w-3 inline mr-1" />
                    Authorized personnel only. All login attempts are monitored.
                  </p>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}