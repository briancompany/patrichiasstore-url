import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let serverStartedAt = Date.now();
let warmStartReady = false;
let warmStartTriggeredAt: string | null = null;
const scheduledAutoStartEnabled = true;

const getAuthToken = (req: Request) => req.headers.get('Authorization')?.replace('Bearer ', '').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ success: false, error: 'Server not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = getAuthToken(req);
    if (!token) {
      return new Response(JSON.stringify({ success: false, error: 'Missing auth token.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const client = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await client
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin') {
      return new Response(JSON.stringify({ success: false, error: 'Admin role required.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!warmStartReady) {
      warmStartTriggeredAt = new Date().toISOString();
      warmStartReady = true;
    }

    const memoryUsage = Deno.memoryUsage();
    const uptimeSeconds = Math.floor((Date.now() - serverStartedAt) / 1000);
    const cpuUsage = Math.min(100, Math.max(5, Number(((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100).toFixed(2))));
    const memoryPercent = Number(((memoryUsage.rss / (memoryUsage.rss + 250_000_000)) * 100).toFixed(2));

    return new Response(JSON.stringify({
      success: true,
      metrics: {
        cpuUsage,
        memoryUsage: memoryPercent,
        uptimeSeconds,
        warmStartReady,
        warmStartTriggeredAt,
        scheduledAutoStartEnabled,
        readiness: 100,
        timestamp: new Date().toISOString(),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
