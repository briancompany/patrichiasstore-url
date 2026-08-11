import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Download, FileText, Loader2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/layout/Layout';
import { downloadQuotation, type QuotationPDFData } from '@/lib/quotation-pdf';
import storeLogo from '@/assets/logo-with-patrichia.png';

function isQuotation(value: unknown): value is QuotationPDFData {
  if (!value || typeof value !== 'object') return false;
  const quotation = value as Record<string, unknown>;
  return typeof quotation.quote_number === 'string'
    && typeof quotation.customer_name === 'string'
    && typeof quotation.total === 'number'
    && Array.isArray(quotation.items);
}

export default function QuotationView() {
  const { token } = useParams();
  const [quotation, setQuotation] = useState<QuotationPDFData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;

    const loadQuotation = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc('get_quotation_public', { _share_token: token });
      if (active) {
        setQuotation(!error && isQuotation(data) ? data : null);
        setLoading(false);
      }
    };

    loadQuotation();
    return () => { active = false; };
  }, [token]);

  const handleDownload = async () => {
    if (!quotation) return;
    setDownloading(true);
    try {
      await downloadQuotation(quotation);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Layout>
      <section className="bg-primary py-10 sm:py-14">
        <div className="container-shop text-center">
          <img src={storeLogo} alt="Patrichia's Store" className="mx-auto h-20 w-20 rounded-md object-cover ring-2 ring-accent" />
          <p className="mt-5 text-sm font-semibold uppercase text-accent">Patrichia's Store</p>
          <h1 className="mt-2 text-3xl text-primary-foreground sm:text-4xl">Your quotation</h1>
        </div>
      </section>

      <section className="container-shop py-10 sm:py-14">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Opening quotation…
          </div>
        ) : !quotation ? (
          <div className="mx-auto max-w-xl border border-border bg-card p-8 text-center shadow-sm">
            <FileText className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-4 text-2xl">Quotation unavailable</h2>
            <p className="mt-2 text-muted-foreground">This link is invalid. Please ask Patrichia's Store to resend your quotation.</p>
            <Button asChild className="mt-6">
              <a href="tel:+254726075180"><Phone /> Call 0726 075 180</a>
            </Button>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl border border-border bg-card shadow-lg">
            <div className="border-b border-border p-6 sm:p-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase text-muted-foreground">Quotation number</p>
                  <h2 className="mt-1 text-2xl text-primary">{quotation.quote_number}</h2>
                  <p className="mt-3 text-sm text-muted-foreground">Prepared for</p>
                  <p className="font-semibold">{quotation.customer_name}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-3xl font-bold text-primary">Ksh {quotation.total.toLocaleString()}</p>
                  <p className="mt-2 text-sm text-muted-foreground">Issued {new Date(quotation.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              <div className="space-y-3">
                {quotation.items.map((item, index) => (
                  <div key={`${item.product_name}-${index}`} className="flex items-start justify-between gap-4 border-b border-border pb-3 text-sm last:border-0">
                    <div>
                      <p className="font-semibold">{item.product_name}</p>
                      <p className="text-muted-foreground">
                        Qty {item.quantity}{item.size ? ` · Size ${item.size}` : ''}{item.color ? ` · ${item.color}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-semibold">Ksh {item.line_total.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <Button size="lg" className="mt-8 w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleDownload} disabled={downloading}>
                {downloading ? <Loader2 className="animate-spin" /> : <Download />}
                {downloading ? 'Preparing PDF…' : 'Download quotation PDF'}
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">Secure document from Patrichia's Store</p>
            </div>
          </div>
        )}
      </section>
    </Layout>
  );
}