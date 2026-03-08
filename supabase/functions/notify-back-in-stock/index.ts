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
    const { productId } = await req.json();

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

    // Get product info
    const { data: product } = await supabase
      .from('products')
      .select('name, in_stock')
      .eq('id', productId)
      .single();

    if (!product || !product.in_stock) {
      return new Response(JSON.stringify({ message: 'Product not in stock' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pending subscribers
    const { data: subscribers } = await supabase
      .from('stock_subscribers')
      .select('id, email')
      .eq('product_id', productId)
      .eq('notified', false);

    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ message: 'No subscribers to notify' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send emails in batches
    let notified = 0;
    for (const sub of subscribers) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [sub.email],
            subject: `🎉 ${product.name} is back in stock!`,
            html: `
              <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #333;">Good news! 🎉</h2>
                <p><strong>${product.name}</strong> is now back in stock at Patrichia's Store.</p>
                <p>Don't miss out — grab yours before it sells out again!</p>
                <a href="https://patrichiasstore-url.lovable.app/shop" 
                   style="display: inline-block; background: #333; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 16px;">
                  Shop Now
                </a>
                <p style="color: #888; font-size: 12px; margin-top: 24px;">
                  You received this because you subscribed for stock alerts on this product.
                </p>
              </div>
            `,
          }),
        });

        if (emailRes.ok) {
          await supabase
            .from('stock_subscribers')
            .update({ notified: true })
            .eq('id', sub.id);
          notified++;
        }
      } catch (e) {
        console.error(`Failed to notify ${sub.email}:`, e);
      }
    }

    return new Response(JSON.stringify({ notified }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
