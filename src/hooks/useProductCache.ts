import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { idbGetWithTTL, idbSetWithTTL } from '@/lib/idb-cache';

interface DBSchool {
  id: string;
  name: string;
  logo_url: string | null;
}

interface GeneralProduct {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  type: string;
  sizes: { size: string; price: number }[];
  in_stock: boolean;
  stock_quantity: number;
  school_id: string | null;
}

interface PricingSize {
  size: string;
  price: number;
}

// In-memory singleton caches
let _generalProducts: GeneralProduct[] | null = null;
let _schools: DBSchool[] | null = null;
let _pricingChart: Record<string, PricingSize[]> | null = null;
let _fetchPromises: Record<string, Promise<void>> = {};

const IDB_KEYS = {
  products: 'ps_general_products',
  schools: 'ps_schools',
  pricing: 'ps_pricing_chart',
};

/**
 * Generic SWR fetch: paint instantly from memory → IDB (even if stale),
 * then revalidate from the network in the background without blocking the UI.
 */
function useSWRCache<T>(
  key: string,
  memRef: { current: T | null },
  fetcher: () => Promise<T | null>,
  setMem: (v: T) => void,
) {
  const [data, setData] = useState<T | null>(memRef.current);
  const [loaded, setLoaded] = useState(memRef.current !== null);

  useEffect(() => {
    let cancelled = false;
    const apply = (v: T) => {
      setMem(v);
      memRef.current = v;
      if (!cancelled) {
        setData(v);
        setLoaded(true);
      }
    };

    // 1. Memory hit — instant, nothing to wait for
    if (memRef.current) {
      setData(memRef.current);
      setLoaded(true);
    } else {
      // 2. IDB hit — paint immediately even when stale (SWR)
      idbGetWithTTL<T>(key).then((cached) => {
        if (cached && !memRef.current) apply(cached.data);
      });
    }

    // 3. Background revalidation, deduplicated across components
    if (!_fetchPromises[key]) {
      _fetchPromises[key] = (async () => {
        try {
          const fresh = await fetcher();
          if (fresh !== null) {
            setMem(fresh);
            memRef.current = fresh;
            await idbSetWithTTL(key, fresh);
          }
        } catch {
          // Offline — keep cached data
        } finally {
          delete _fetchPromises[key];
        }
      })();
    }

    _fetchPromises[key]!.then(() => {
      if (cancelled) return;
      if (memRef.current) setData(memRef.current);
      setLoaded(true);
    });

    return () => { cancelled = true; };
  }, []);

  return { data, loaded };
}


// Memory refs as stable objects
const _productsRef = { get current() { return _generalProducts; }, set current(v) { _generalProducts = v; } };
const _schoolsRef = { get current() { return _schools; }, set current(v) { _schools = v; } };
const _pricingRef = { get current() { return _pricingChart; }, set current(v) { _pricingChart = v; } };

export function useGeneralProducts() {
  const { data, loaded } = useSWRCache<GeneralProduct[]>(
    IDB_KEYS.products,
    _productsRef,
    async () => {
      const { data } = await supabase
        .from('products')
        .select('id, name, description, image_url, type, sizes, in_stock, stock_quantity, school_id')
        .is('school_id', null)
        .order('name');
      if (!data) return null;
      return data.map((p) => ({
        ...p,
        stock_quantity: Number(p.stock_quantity ?? 0),
        sizes: Array.isArray(p.sizes) ? (p.sizes as { size: string; price: number }[]) : [],
      }));
    },
    (v) => { _generalProducts = v; },
  );
  return { products: data ?? [], loaded };
}

export function useSchoolsList() {
  const { data } = useSWRCache<DBSchool[]>(
    IDB_KEYS.schools,
    _schoolsRef,
    async () => {
      const { data } = await supabase
        .from('schools')
        .select('id, name, logo_url')
        .order('name');
      return data ?? null;
    },
    (v) => { _schools = v; },
  );
  return data ?? [];
}

export function usePricingChart() {
  const { data } = useSWRCache<Record<string, PricingSize[]>>(
    IDB_KEYS.pricing,
    _pricingRef,
    async () => {
      const { data } = await supabase
        .from('pricing_chart')
        .select('uniform_type, size, price')
        .order('uniform_type')
        .order('size');
      if (!data) return null;
      const grouped: Record<string, PricingSize[]> = {};
      data.forEach((item: { uniform_type: string; size: string; price: number }) => {
        if (!grouped[item.uniform_type]) grouped[item.uniform_type] = [];
        grouped[item.uniform_type].push({ size: item.size, price: item.price });
      });
      return grouped;
    },
    (v) => { _pricingChart = v; },
  );
  return data ?? {};
}

/**
 * Warm the product/school/pricing caches ahead of navigation so the Shop
 * renders instantly on first visit. Safe to call multiple times.
 */
export function prefetchStoreData() {
  const jobs: [string, () => Promise<unknown>][] = [
    [IDB_KEYS.products, async () => {
      if (_generalProducts) return;
      const { data } = await supabase
        .from('products')
        .select('id, name, description, image_url, type, sizes, in_stock, stock_quantity, school_id')
        .is('school_id', null)
        .order('name');
      if (!data) return;
      const mapped = data.map((p) => ({
        ...p,
        stock_quantity: Number(p.stock_quantity ?? 0),
        sizes: Array.isArray(p.sizes) ? (p.sizes as unknown as PricingSize[]) : [],
      })) as GeneralProduct[];
      _generalProducts = mapped;
      await idbSetWithTTL(IDB_KEYS.products, mapped);
    }],
    [IDB_KEYS.schools, async () => {
      if (_schools) return;
      const { data } = await supabase.from('schools').select('id, name, logo_url').order('name');
      if (!data) return;
      _schools = data;
      await idbSetWithTTL(IDB_KEYS.schools, data);
    }],
  ];

  jobs.forEach(([key, run]) => {
    if (_fetchPromises[key]) return;
    _fetchPromises[key] = (async () => {
      try { await run(); } catch { /* offline */ } finally { delete _fetchPromises[key]; }
    })();
  });
}
