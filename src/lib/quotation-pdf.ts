import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/integrations/supabase/client';
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
const STORE_NAME = "Patrichia's Store";
const STORE_TAGLINE = 'Quality School Uniforms · Nairobi, Kenya';

// #0B1736 navy, #D4AF37 gold
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

/**
 * Build a premium navy + gold branded PDF for a quotation.
 * Returns a Blob so the caller can upload / download / print.
 */
export async function buildQuotationPDF(q: QuotationPDFData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 40;

  // Navy header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 110, 'F');

  // Gold accent line under header
  doc.setFillColor(...GOLD);
  doc.rect(0, 110, pageW, 3, 'F');

  // Logo
  const logo = await getLogoDataUrl();
  if (logo) {
    try { doc.addImage(logo, 'PNG', margin, 24, 62, 62); } catch { /* ignore */ }
  }

  // Brand text
  doc.setTextColor(...GOLD);
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(STORE_NAME, margin + 78, 52);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(230, 220, 190);
  doc.text(STORE_TAGLINE, margin + 78, 68);
  doc.text(`${STORE_LOCATION}  ·  ${STORE_PHONE}`, margin + 78, 82);

  // QUOTATION label right-aligned
  doc.setFont('times', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...GOLD);
  doc.text('QUOTATION', pageW - margin, 52, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(230, 220, 190);
  doc.text(`No. ${q.quote_number}`, pageW - margin, 68, { align: 'right' });
  doc.text(new Date(q.created_at).toLocaleDateString(), pageW - margin, 82, { align: 'right' });

  // Customer + meta blocks
  let y = 145;
  doc.setTextColor(...MUTED);
  doc.setFontSize(8);
  doc.text('BILLED TO', margin, y);
  doc.text('QUOTATION DETAILS', pageW / 2 + 10, y);

  y += 14;
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(q.customer_name, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(q.customer_phone, margin, y + 14);
  if (q.customer_email) doc.text(q.customer_email, margin, y + 28);

  const metaX = pageW / 2 + 10;
  doc.setFontSize(10);
  doc.text(`Issued: ${new Date(q.created_at).toLocaleDateString()}`, metaX, y);
  if (q.valid_until) doc.text(`Valid until: ${new Date(q.valid_until).toLocaleDateString()}`, metaX, y + 14);
  if (q.staff_name) doc.text(`Prepared by: ${q.staff_name}`, metaX, y + 28);

  // Items table
  const bodyRows = q.items.map((it, i) => [
    String(i + 1),
    `${it.product_name}${it.size ? ` · ${it.size}` : ''}${it.color ? ` (${it.color})` : ''}`,
    String(it.quantity),
    `Ksh ${it.unit_price.toLocaleString()}`,
    `Ksh ${it.line_total.toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: y + 55,
    head: [['#', 'Item', 'Qty', 'Unit', 'Total']],
    body: bodyRows.length ? bodyRows : [['', 'No items', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: NAVY, textColor: GOLD, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: INK },
    alternateRowStyles: { fillColor: [250, 248, 240] },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      2: { halign: 'right', cellWidth: 45 },
      3: { halign: 'right', cellWidth: 80 },
      4: { halign: 'right', cellWidth: 90 },
    },
    margin: { left: margin, right: margin },
  });

  // Totals
  // @ts-expect-error jspdf-autotable augments doc with lastAutoTable
  let ty = (doc.lastAutoTable?.finalY ?? y + 100) + 18;
  const totalsX = pageW - margin - 220;
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text('Subtotal', totalsX, ty);
  doc.text(`Ksh ${q.subtotal.toLocaleString()}`, pageW - margin, ty, { align: 'right' });
  ty += 16;
  if (q.discount > 0) {
    doc.text('Discount', totalsX, ty);
    doc.text(`- Ksh ${q.discount.toLocaleString()}`, pageW - margin, ty, { align: 'right' });
    ty += 16;
  }

  // Grand total row on navy
  doc.setFillColor(...NAVY);
  doc.rect(totalsX - 12, ty - 12, pageW - margin - (totalsX - 12), 30, 'F');
  doc.setTextColor(...GOLD);
  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL', totalsX, ty + 6);
  doc.text(`Ksh ${q.total.toLocaleString()}`, pageW - margin, ty + 6, { align: 'right' });

  // Notes
  if (q.notes) {
    const ny = ty + 50;
    doc.setFillColor(250, 246, 232);
    doc.rect(margin, ny, pageW - margin * 2, 46, 'F');
    doc.setDrawColor(...GOLD);
    doc.setLineWidth(1);
    doc.line(margin, ny, margin, ny + 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text('Notes', margin + 10, ny + 14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    const wrapped = doc.splitTextToSize(q.notes, pageW - margin * 2 - 20);
    doc.text(wrapped, margin + 10, ny + 28);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 40;
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.6);
  doc.line(margin, footerY - 12, pageW - margin, footerY - 12);
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`${STORE_NAME}  ·  ${STORE_LOCATION}  ·  ${STORE_PHONE}`, pageW / 2, footerY, { align: 'center' });
  doc.setFontSize(8);
  doc.text(
    q.valid_until
      ? `This quotation is valid until ${new Date(q.valid_until).toLocaleDateString()}.`
      : 'This quotation is valid for 7 days from date of issue.',
    pageW / 2,
    footerY + 12,
    { align: 'center' },
  );

  return doc.output('blob');
}

/** Upload a quotation PDF to storage and return a signed public download URL. */
export async function uploadQuotationPDF(
  quoteNumber: string,
  blob: Blob,
): Promise<{ path: string; url: string }> {
  const path = `${new Date().getFullYear()}/${quoteNumber}.pdf`;
  const { error } = await supabase.storage
    .from('quotations')
    .upload(path, blob, { upsert: true, contentType: 'application/pdf' });
  if (error) throw error;
  // 30-day signed URL — plenty of time for the customer to download
  const { data, error: signErr } = await supabase.storage
    .from('quotations')
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (signErr || !data?.signedUrl) throw signErr || new Error('Could not create download link');
  return { path, url: data.signedUrl };
}

export async function refreshQuotationLink(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from('quotations')
    .createSignedUrl(path, 60 * 60 * 24 * 30);
  if (error || !data?.signedUrl) throw error || new Error('Link unavailable');
  return data.signedUrl;
}

export async function downloadQuotationPDF(q: QuotationPDFData) {
  const blob = await buildQuotationPDF(q);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${q.quote_number}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function openQuotationPDF(q: QuotationPDFData) {
  const blob = await buildQuotationPDF(q);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function whatsappQuotationLink(q: QuotationPDFData, downloadUrl: string) {
  const phone = String(q.customer_phone).replace(/[^0-9]/g, '');
  const to = phone.startsWith('254') ? phone : '254' + phone.replace(/^0/, '');
  const msg =
    `Hello ${q.customer_name}, here is your quotation *${q.quote_number}* from ${STORE_NAME}.%0A%0A` +
    `Total: Ksh ${q.total.toLocaleString()}%0A` +
    (q.valid_until ? `Valid until: ${new Date(q.valid_until).toLocaleDateString()}%0A` : '') +
    `%0ADownload your PDF here:%0A${encodeURIComponent(downloadUrl)}%0A%0ATo order, call ${STORE_PHONE}.`;
  window.open(`https://wa.me/${to}?text=${msg}`, '_blank');
}

// ---- Back-compat aliases so existing imports keep working ----
export const downloadQuotation = downloadQuotationPDF;
export const printQuotation = openQuotationPDF;
export async function whatsappQuotation(q: QuotationPDFData) {
  const blob = await buildQuotationPDF(q);
  const { url } = await uploadQuotationPDF(q.quote_number, blob);
  whatsappQuotationLink(q, url);
}