import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type LiveAd = { id: string; advertiser_name: string; title: string | null; image_url: string; link_url: string | null };

const seen = new Set<string>();

export function AdBanner({ placement, className = '' }: { placement: 'home' | 'shop' | 'product'; className?: string }) {
  const [ads, setAds] = useState<LiveAd[]>([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    supabase.rpc('get_live_ads', { _placement: placement }).then(({ data }) => {
      if (alive && data) setAds(data as LiveAd[]);
    });
    return () => { alive = false; };
  }, [placement]);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % ads.length), 7000);
    return () => clearInterval(t);
  }, [ads.length]);

  const ad = ads[idx];

  useEffect(() => {
    if (!ad || !ref.current) return;
    const key = `${ad.id}:${placement}`;
    if (seen.has(key)) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !seen.has(key)) {
        seen.add(key);
        supabase.rpc('record_ad_event', { _ad_id: ad.id, _kind: 'view' });
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ad, placement]);

  if (!ad) return null;

  const img = (
    <img
      src={ad.image_url}
      alt={ad.title || ad.advertiser_name}
      loading="lazy"
      className="w-full h-auto max-h-48 object-cover rounded-lg"
    />
  );

  return (
    <div ref={ref} className={`relative ${className}`} aria-label="Sponsored">
      <span className="absolute top-2 left-2 z-10 rounded bg-background/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
        Sponsored
      </span>
      {ad.link_url ? (
        <a
          href={ad.link_url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          onClick={() => supabase.rpc('record_ad_event', { _ad_id: ad.id, _kind: 'click' })}
        >
          {img}
        </a>
      ) : img}
    </div>
  );
}
