import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import storeLogo from "@/assets/logo-with-patrichia.png";

// Beta namespace — narrow the client for TS.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        // Send user to admin login preserving the full consent URL.
        const next = window.location.pathname + window.location.search;
        window.location.href = "/admin/login?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauth) {
        setError("This app's authorization server SDK is not available. Please update the app.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    if (!oauth) return;
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Authorization error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const clientName = details.client?.name ?? "an external app";

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <img src={storeLogo} alt="Patrichia's Store" className="h-14 w-14 object-contain" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Connect {clientName} to Patrichia's Store
          </CardTitle>
          <CardDescription>
            This lets {clientName} use this app as you. It does not bypass this app's permissions or backend policies.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-card p-3 text-sm space-y-1">
            <div className="text-muted-foreground">Requested permissions</div>
            <ul className="list-disc pl-5">
              <li>Share your basic profile</li>
              <li>Share your email address</li>
              <li>Call this app's enabled tools while you are signed in</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              Cancel connection
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}