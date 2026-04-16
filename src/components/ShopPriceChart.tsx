import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, X } from 'lucide-react';

interface StoreContent {
  owner_photo_url: string | null;
  price_chart_url: string | null;
  shop_description: string;
}

export function ShopPriceChart() {
  const [content, setContent] = useState<StoreContent | null>(null);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => {
    supabase
      .from('store_content')
      .select('owner_photo_url, price_chart_url, shop_description')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setContent(data);
      });
  }, []);

  if (!content || (!content.price_chart_url && !content.shop_description)) return null;

  const handleDownload = async () => {
    if (!content.price_chart_url) return;
    try {
      const response = await fetch(content.price_chart_url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'patrichia-store-price-chart.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(content.price_chart_url, '_blank');
    }
  };

  return (
    <>
      <div className="mb-8 space-y-6">
        {/* Price Chart Image - Pinterest style: full width, no crop */}
        {content.price_chart_url && (
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="relative group">
                <img
                  src={content.price_chart_url}
                  alt="Price Chart"
                  className="w-full h-auto cursor-pointer"
                  onClick={() => setZoomed(true)}
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 flex justify-between items-end opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setZoomed(true)}
                    className="gap-2"
                  >
                    <ZoomIn className="h-4 w-4" />
                    View Full Size
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownload}
                    className="gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shop Description */}
        {content.shop_description && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-6">
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-line">
                {content.shop_description}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Fullscreen zoom overlay */}
      {zoomed && content.price_chart_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-start justify-center overflow-auto p-4"
          onClick={() => setZoomed(false)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full"
              onClick={() => setZoomed(false)}
            >
              <X className="h-5 w-5" />
            </Button>
            <img
              src={content.price_chart_url}
              alt="Price Chart - Full Size"
              className="w-full h-auto rounded-lg"
            />
            <div className="flex justify-center mt-4">
              <Button onClick={handleDownload} variant="secondary" className="gap-2">
                <Download className="h-4 w-4" />
                Download Chart
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
