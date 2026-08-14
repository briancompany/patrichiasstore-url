import { sendGmail } from '../_shared/gmail.ts';

Deno.serve(async () => {
  const result = await sendGmail({
    to: Deno.env.get('GMAIL_USER')!,
    subject: 'SMTP test - Patrichia Store',
    html: '<p>Gmail SMTP is working.</p>',
  });
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
