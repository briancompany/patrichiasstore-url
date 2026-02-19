import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaymentMethod = 'mpesa' | 'pesapal';

interface ConfirmRequest {
  orderId: string;
  paymentMethod: PaymentMethod;
  mpesaMessage?: string;
  transactionCode?: string;
}

const parseMpesaMessage = (message: string) => {
  const amountMatch = message.match(/Ksh[\s]?([\d,]+(?:\.\d{2})?)/i);
  const confirmCodeMatch = message.match(/^([A-Z0-9]{8,12})/);
  const confirmedMatch = message.toLowerCase().includes('confirmed');

  return {
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : null,
    confirmCode: confirmCodeMatch ? confirmCodeMatch[1] : null,
    isConfirmed: confirmedMatch,
  };
};

const logVerification = async (
  supabase: ReturnType<typeof createClient>,
  payload: {
    order_id?: string;
    payment_method: PaymentMethod;
    transaction_reference?: string | null;
    verification_status: 'approved' | 'rejected' | 'error';
    verification_message: string;
    metadata?: Record<string, unknown>;
  },
) => {
  await supabase.from('payment_verification_logs').insert({
    order_id: payload.order_id ?? null,
    payment_method: payload.payment_method,
    transaction_reference: payload.transaction_reference ?? null,
    verification_status: payload.verification_status,
    verification_message: payload.verification_message,
    metadata: payload.metadata ?? {},
  });
};

const requestPesapalToken = async () => {
  const consumerKey = Deno.env.get('PESAPAL_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('PESAPAL_CONSUMER_SECRET');

  if (!consumerKey || !consumerSecret) {
    throw new Error('Pesapal credentials are missing in environment variables.');
  }

  const response = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumer_key: consumerKey, consumer_secret: consumerSecret }),
  });

  if (!response.ok) {
    throw new Error(`Pesapal token request failed with status ${response.status}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('Pesapal token was not returned by API.');
  }

  return data.token as string;
};

const verifyPesapalTransaction = async (transactionCode: string) => {
  const token = await requestPesapalToken();

  const statusResponse = await fetch(
    `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(transactionCode)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  if (!statusResponse.ok) {
    throw new Error(`Pesapal status lookup failed with status ${statusResponse.status}`);
  }

  const statusPayload = await statusResponse.json();
  const paymentStatus = String(statusPayload?.payment_status_description || statusPayload?.payment_status || '').toLowerCase();

  return {
    approved: ['completed', 'paid', 'success'].some((word) => paymentStatus.includes(word)),
    amount: Number(statusPayload?.amount ?? 0),
    payload: statusPayload,
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ success: false, error: 'Server is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminDb = createClient(supabaseUrl, serviceRole);
    const payload = (await req.json()) as ConfirmRequest;

    if (!payload.orderId || !payload.paymentMethod) {
      return new Response(JSON.stringify({ success: false, error: 'orderId and paymentMethod are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: order, error: orderError } = await adminDb
      .from('orders')
      .select('id, total_amount, customer_name, customer_phone, status')
      .eq('id', payload.orderId)
      .maybeSingle();

    if (orderError || !order) {
      await logVerification(adminDb, {
        order_id: payload.orderId,
        payment_method: payload.paymentMethod,
        transaction_reference: payload.transactionCode,
        verification_status: 'error',
        verification_message: 'Order not found during verification.',
      });

      return new Response(JSON.stringify({ success: false, error: 'Order not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (order.status === 'confirmed') {
      return new Response(JSON.stringify({ success: true, alreadyConfirmed: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let transactionCode = (payload.transactionCode || '').trim().toUpperCase();
    let amount = Number(order.total_amount);
    let verificationMessage = 'Payment confirmed by backend verification.';
    let metadata: Record<string, unknown> = {};

    if (payload.paymentMethod === 'mpesa') {
      const parsed = parseMpesaMessage(payload.mpesaMessage || '');

      if (!parsed.isConfirmed || !parsed.amount || !parsed.confirmCode) {
        await logVerification(adminDb, {
          order_id: order.id,
          payment_method: payload.paymentMethod,
          verification_status: 'rejected',
          verification_message: 'M-Pesa confirmation SMS format was invalid.',
          metadata: { hasMessage: Boolean(payload.mpesaMessage) },
        });

        return new Response(JSON.stringify({ success: false, error: 'Payment verification failed.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      transactionCode = parsed.confirmCode;
      amount = parsed.amount;

      if (amount !== Number(order.total_amount)) {
        await logVerification(adminDb, {
          order_id: order.id,
          payment_method: payload.paymentMethod,
          transaction_reference: transactionCode,
          verification_status: 'rejected',
          verification_message: 'M-Pesa amount does not match order amount.',
          metadata: { paidAmount: amount, expectedAmount: order.total_amount },
        });

        return new Response(JSON.stringify({ success: false, error: 'Payment amount mismatch.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (payload.paymentMethod === 'pesapal') {
      if (!transactionCode) {
        return new Response(JSON.stringify({ success: false, error: 'transactionCode is required.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pesapal = await verifyPesapalTransaction(transactionCode);
      metadata = { pesapal: pesapal.payload };
      amount = pesapal.amount || amount;

      if (!pesapal.approved || amount !== Number(order.total_amount)) {
        await logVerification(adminDb, {
          order_id: order.id,
          payment_method: payload.paymentMethod,
          transaction_reference: transactionCode,
          verification_status: 'rejected',
          verification_message: 'Pesapal payment status is not approved or amount mismatch.',
          metadata: { approved: pesapal.approved, paidAmount: amount, expectedAmount: order.total_amount },
        });

        return new Response(JSON.stringify({ success: false, error: 'Pesapal payment not confirmed yet.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const { data: duplicate } = await adminDb
      .from('payments')
      .select('id')
      .eq('mpesa_code', transactionCode)
      .maybeSingle();

    if (duplicate) {
      await logVerification(adminDb, {
        order_id: order.id,
        payment_method: payload.paymentMethod,
        transaction_reference: transactionCode,
        verification_status: 'rejected',
        verification_message: 'Duplicate transaction reference was rejected.',
      });

      return new Response(JSON.stringify({ success: false, error: 'Transaction code already used.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await adminDb.from('orders').update({
      status: 'confirmed',
      notes: `Payment confirmed by backend. Method: ${payload.paymentMethod.toUpperCase()} | Ref: ${transactionCode}`,
    }).eq('id', order.id);

    await adminDb.from('payments').insert({
      order_id: order.id,
      amount,
      mpesa_code: transactionCode,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
    });

    await logVerification(adminDb, {
      order_id: order.id,
      payment_method: payload.paymentMethod,
      transaction_reference: transactionCode,
      verification_status: 'approved',
      verification_message: verificationMessage,
      metadata,
    });

    return new Response(JSON.stringify({ success: true, transactionCode }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('secure-payment-confirmation error', error);
    const message = error instanceof Error ? error.message : 'Unexpected server error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
