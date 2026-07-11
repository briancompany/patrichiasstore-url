import storeLogo from '@/assets/logo-with-patrichia.png';

export interface QuotationPDFData {
  quote_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  staff_name?: string | null;
  created_at: string;
  valid_until?: string | null;
  notes?: string | null;
  subtotal: number;
  discount: number;
  total: number;
  items: {
    product_name: string;
    size?: string | null;
    color?: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
}

const STORE_PHONE = '0726075180';
const STORE_LOCATION = 'Uhuru Market, Store F47';

export function buildQuotationHTML(q: QuotationPDFData): string {
  const itemsHTML = q.items
    .map(
      (it, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(it.product_name)}${it.size ? ` — ${escapeHtml(it.size)}` : ''}${it.color ? ` (${escapeHtml(it.color)})` : ''}</td>
        <td class="right">${it.quantity}</td>
        <td class="right">Ksh ${it.unit_price.toLocaleString()}</td>
        <td class="right">Ksh ${it.line_total.toLocaleString()}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Quotation ${q.quote_number}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;padding:32px;max-width:780px;margin:0 auto;color:#111}
    .header{display:flex;align-items:center;gap:16px;border-bottom:3px solid #7c3aed;padding-bottom:16px;margin-bottom:24px}
    .header img{width:72px;height:72px;object-fit:contain}
    .brand h1{margin:0;color:#7c3aed;font-size:24px}
    .brand p{margin:2px 0;color:#555;font-size:12px}
    .meta{display:flex;justify-content:space-between;gap:24px;margin-bottom:20px;font-size:13px}
    .meta .box{background:#f8f7ff;padding:12px 14px;border-radius:8px;flex:1}
    .meta strong{color:#7c3aed}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
    th,td{padding:10px 8px;border-bottom:1px solid #eee;text-align:left}
    th{background:#7c3aed;color:#fff;font-weight:600}
    td.right,th.right{text-align:right}
    .totals{margin-top:16px;margin-left:auto;width:280px;font-size:14px}
    .totals div{display:flex;justify-content:space-between;padding:6px 0}
    .totals .grand{border-top:2px solid #7c3aed;padding-top:10px;font-weight:700;font-size:18px;color:#7c3aed}
    .footer{margin-top:32px;padding-top:16px;border-top:1px dashed #ccc;text-align:center;color:#666;font-size:12px}
    .notes{background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin-top:16px;font-size:13px;border-radius:6px}
    @media print{body{padding:12px}}
  </style></head><body>
  <div class="header">
    <img src="${storeLogo}" alt="Patrichia's Store"/>
    <div class="brand">
      <h1>Patrichia's Store</h1>
      <p>Quality School Uniforms</p>
      <p>📍 ${STORE_LOCATION} · 📞 ${STORE_PHONE}</p>
    </div>
  </div>

  <div class="meta">
    <div class="box">
      <div><strong>Quotation:</strong> ${q.quote_number}</div>
      <div><strong>Date:</strong> ${new Date(q.created_at).toLocaleDateString()}</div>
      ${q.valid_until ? `<div><strong>Valid until:</strong> ${new Date(q.valid_until).toLocaleDateString()}</div>` : ''}
      ${q.staff_name ? `<div><strong>Prepared by:</strong> ${escapeHtml(q.staff_name)}</div>` : ''}
    </div>
    <div class="box">
      <div><strong>Customer:</strong> ${escapeHtml(q.customer_name)}</div>
      <div><strong>Phone:</strong> ${escapeHtml(q.customer_phone)}</div>
      ${q.customer_email ? `<div><strong>Email:</strong> ${escapeHtml(q.customer_email)}</div>` : ''}
    </div>
  </div>

  <table>
    <thead><tr><th>#</th><th>Item</th><th class="right">Qty</th><th class="right">Unit</th><th class="right">Total</th></tr></thead>
    <tbody>${itemsHTML || '<tr><td colspan="5" style="text-align:center;color:#999">No items</td></tr>'}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span>Ksh ${q.subtotal.toLocaleString()}</span></div>
    ${q.discount > 0 ? `<div><span>Discount</span><span>- Ksh ${q.discount.toLocaleString()}</span></div>` : ''}
    <div class="grand"><span>Total</span><span>Ksh ${q.total.toLocaleString()}</span></div>
  </div>

  ${q.notes ? `<div class="notes"><strong>Notes:</strong> ${escapeHtml(q.notes)}</div>` : ''}

  <div class="footer">
    <p>Thank you for choosing Patrichia's Store 🙏</p>
    <p>This quotation is valid ${q.valid_until ? `until ${new Date(q.valid_until).toLocaleDateString()}` : 'for 7 days from date of issue'}.</p>
    <p>Call ${STORE_PHONE} to place your order.</p>
  </div>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;
}

export function downloadQuotation(q: QuotationPDFData) {
  const html = buildQuotationHTML(q);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `quotation-${q.quote_number}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function printQuotation(q: QuotationPDFData) {
  const html = buildQuotationHTML(q);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

export function whatsappQuotation(q: QuotationPDFData) {
  const phone = String(q.customer_phone).replace(/[^0-9]/g, '');
  const lines = q.items
    .map((it) => `• ${it.product_name}${it.size ? ` (${it.size})` : ''} × ${it.quantity} — Ksh ${it.line_total.toLocaleString()}`)
    .join('%0A');
  const msg =
    `Hello ${q.customer_name}, here is your quotation ${q.quote_number} from Patrichia's Store:%0A%0A` +
    `${lines}%0A%0ATotal: Ksh ${q.total.toLocaleString()}%0A` +
    (q.valid_until ? `Valid until: ${new Date(q.valid_until).toLocaleDateString()}%0A` : '') +
    `%0ATo order call ${STORE_PHONE}.`;
  window.open(`https://wa.me/${phone.startsWith('254') ? phone : '254' + phone.replace(/^0/, '')}?text=${msg}`, '_blank');
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}