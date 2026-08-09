import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import storeLogo from '@/assets/logo-with-patrichia.png';

export interface ReceiptItem {
  product_name: string;
  size?: string | null;
  color?: string | null;
  quantity: number;
  price: number;
  printing_required?: boolean | null;
}

export interface ReceiptData {
  order_id: string;
  tracking_code?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_school?: string | null;
  date: string;
  payment_method?: string | null;
  status?: string | null;
  delivery_type?: string | null;
  delivery_location?: string | null;
  total: number;
  items?: ReceiptItem[];
  item_count?: number | null;
  note?: string | null;
}

const STORE_PHONE = '0726075180';
const STORE_LOCATION = 'Uhuru Market, Store F47';
const STORE_NAME = "Patrichia's Store";
const STORE_TAGLINE = 'Quality School Uniforms · Nairobi, Kenya';

const NAVY: [number, number, number] = [11, 23, 54];
const GOLD: [number, number, number] = [212, 175, 55];
const INK: [number, number, number] = [30, 30, 40];
const MUTED: [number, number, number] = [110, 110, 125];

let cachedLogo: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(storeLogo);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        cachedLogo = fr.result as string;
        resolve(cachedLogo);
      };
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Navy + gold branded receipt, styled to match the quotation document. */
export async function buildReceiptPDF(r: ReceiptData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 110, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 110, pageW, 3, 'F');

  const logo = await getLogoDataUrl();
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 24, 62, 62); } catch { /* ignore */ }
  }

  doc.setTextColor(...GOLD);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(STORE_NAME, margin + 78, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 220, 190);
  doc.text(STORE_TAGLINE, margin + 78, 68);
  doc.text(`${STORE_LOCATION}  ·  ${STORE_PHONE}`, margin + 78, 82);

  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  doc.text('RECEIPT', pageW - margin, 52, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(230, 220, 190);
  doc.text(`No. ${r.tracking_code || r.order_id.slice(0, 8).toUpperCase()}`, pageW - margin, 68, { align: 'right' });
  doc.text(new Date(r.date).toLocaleDateString(), pageW - margin, 82, { align: 'right' });

  // Customer + meta
  let y = 145;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text('RECEIVED FROM', margin, y);
  doc.text('ORDER DETAILS', pageW / 2 + 10, y);

  y += 14;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(r.customer_name, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  let cy = y + 14;
  if (r.customer_phone) { doc.text(r.customer_phone, margin, cy); cy += 14; }
  if (r.customer_school) { doc.text(r.customer_school, margin, cy); cy += 14; }

  const metaX = pageW / 2 + 10;
  let my = y;
  doc.setFontSize(10);
  doc.text(`Order ID: ${r.order_id.slice(0, 8).toUpperCase()}`, metaX, my); my += 14;
  if (r.tracking_code) { doc.text(`Tracking: ${r.tracking_code}`, metaX, my); my += 14; }
  if (r.payment_method) { doc.text(`Payment: ${r.payment_method}`, metaX, my); my += 14; }
  if (r.delivery_type) {
    doc.text(
      r.delivery_type === 'pickup'
        ? 'Fulfilment: Store pickup'
        : `Fulfilment: Delivery${r.delivery_location ? ` · ${r.delivery_location}` : ''}`,
      metaX,
      my,
    );
    my += 14;
  }

  const blockEnd = Math.max(cy, my) + 16;

  // Items table (or summary line when items are not available)
  const items = r.items ?? [];
  const bodyRows = items.length
    ? items.map((it, i) => [
        String(i + 1),
        `${it.product_name}${it.size ? ` · ${it.size}` : ''}${it.color ? ` (${it.color})` : ''}${it.printing_required ? ' · logo printing' : ''}`,
        String(it.quantity),
        `Ksh ${it.price.toLocaleString()}`,
      ])
    : [['1', `Order items (${r.item_count ?? 0})`, String(r.item_count ?? 0), `Ksh ${r.total.toLocaleString()}`]];

  autoTable(doc, {
    startY: blockEnd,
    head: [['#', 'Item', 'Qty', 'Amount']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: GOLD, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: INK },
    alternateRowStyles: { fillColor: [250, 248, 240] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      2: { halign: 'right', cellWidth: 50 },
      3: { halign: 'right', cellWidth: 100 },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable
  let ty = (doc.lastAutoTable?.finalY ?? blockEnd + 100) + 24;
  const totalsX = pageW - margin - 220;

  doc.setFillColor(...NAVY);
  doc.rect(totalsX - 12, ty - 12, pageW - margin - (totalsX - 12), 30, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('AMOUNT PAID', totalsX, ty + 6);
  doc.text(`Ksh ${r.total.toLocaleString()}`, pageW - margin, ty + 6, { align: 'right' });

  // Paid stamp
  ty += 46;
  doc.setFillColor(...GOLD);
  doc.rect(margin, ty, 120, 24, 'F');
  doc.setTextColor(...NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text((r.status || 'PAID').toUpperCase(), margin + 60, ty + 16, { align: 'center' });

  if (r.note) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    const wrapped = doc.splitTextToSize(r.note, pageW - margin * 2);
    doc.text(wrapped, margin, ty + 46);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 12, pageW - margin, footerY - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${STORE_NAME}  ·  ${STORE_LOCATION}  ·  ${STORE_PHONE}`, pageW / 2, footerY, { align: 'center' });
  doc.setFontSize(8);
  doc.text('Thank you for shopping with us. Keep this receipt for any follow-up or warranty claim.', pageW / 2, footerY + 12, { align: 'center' });

  return doc.output('blob');
}

export async function downloadReceiptPDF(r: ReceiptData) {
  const blob = await buildReceiptPDF(r);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${r.tracking_code || r.order_id.slice(0, 8)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function printReceiptPDF(r: ReceiptData) {
  const blob = await buildReceiptPDF(r);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}