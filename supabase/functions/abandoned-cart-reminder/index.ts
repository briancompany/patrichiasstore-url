import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const FROM_EMAIL = Deno.env.get('RECEIPT_FROM_EMAIL') || 'Patrichia Store <onboarding@resend.dev>';

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find orders that are pending and older than 1 hour with contact email
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: pendingOrders } = await supabase
      .from('orders')
      .select('id, customer_name, total_amount, created_at')
      .in('status', ['pending', 'awaiting_payment'])
      .lt('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!pendingOrders || pendingOrders.length === 0) {
      return new Response(JSON.stringify({ message: 'No abandoned orders' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    for (const order of pendingOrders) {
      // Get contact email
      const { data: email } = await supabase.rpc('get_order_contact_email', { _order_id: order.id });
      if (!email) continue;

      // Check if already sent a reminder (simple: check receipt_emails table for this order)
      const { data: existing } = await supabase
        .from('receipt_emails')
        .select('id')
        .eq('order_id', order.id)
        .limit(1);

      if (existing && existing.length > 0) continue;

      try {
        const WHATSAPP_NUMBER = '254726075180';
        const whatsappLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Hi, I need help completing my order (${order.id.slice(0, 8)})`)}`;

        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [email],
            subject: `${order.customer_name}, your order is waiting! 🛒`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Hi ${order.customer_name}! 👋</h2>
                <p>You have an incomplete order worth <strong>Ksh ${order.total_amount.toLocaleString()}</strong> at Patrichia's Store.</p>
                <p>Complete your payment to secure your items before they sell out!</p>
                <a href="https://patrichiasstore-url.lovable.app/payment" 
                   style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
                  Complete Payment
                </a>
                <p style="margin-top: 20px;">Need help? <a href="${whatsappLink}" style="color: #25D366;">Chat with us on WhatsApp</a></p>
                <p style="color: #888; font-size: 12px; margin-top: 24px;">
                  If you've already completed your payment, please ignore this email.
                </p>
              </div>
            `,
          }),
        });

        if (emailRes.ok) sent++;
      } catch (e) {
        console.error('Failed to send reminder:', e);
      }
    }

    return new Response(JSON.stringify({ sent, checked: pendingOrders.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
