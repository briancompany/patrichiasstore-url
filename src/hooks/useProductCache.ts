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
 * Generic SWR fetch: serve from memory → IDB → network.
 * Background refresh when stale.
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
    // 1. Already in memory and fresh
    if (memRef.current) {
      setData(memRef.current);
      setLoaded(true);
    }

    // 2. Deduplicated fetch: IDB → network
    if (!_fetchPromises[key]) {
      _fetchPromises[key] = (async () => {
        try {
          // Try IDB first
          const cached = await idbGetWithTTL<T>(key);
          if (cached) {
            setMem(cached.data);
            memRef.current = cached.data;
            // If not stale, done
            if (!cached.stale && memRef.current) return;
          }

          // Fetch from network
          const fresh = await fetcher();
          if (fresh) {
            setMem(fresh);
            memRef.current = fresh;
            await idbSetWithTTL(key, fresh);
          }
        } catch {
          // Offline — use whatever we have
        } finally {
          delete _fetchPromises[key];
        }
      })();
    }

    _fetchPromises[key]!.then(() => {
      if (memRef.current) setData(memRef.current);
      setLoaded(true);
    });
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
        .select('id, name, description, image_url, type, sizes, in_stock, school_id')
        .is('school_id', null)
        .eq('in_stock', true)
        .order('name');
      if (!data) return null;
      return data.map((p) => ({
        ...p,
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
