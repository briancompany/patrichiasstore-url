import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { STORAGE_KEYS, storageGet, storageSet } from '@/lib/persist';

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

// In-memory singleton caches so multiple components share the same data
let _generalProducts: GeneralProduct[] | null = null;
let _schools: DBSchool[] | null = null;
let _pricingChart: Record<string, PricingSize[]> | null = null;
let _fetchPromises: Record<string, Promise<void>> = {};

const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function isCacheStale(): boolean {
  const ts = storageGet<number>(STORAGE_KEYS.cacheTimestamp);
  if (!ts) return true;
  return Date.now() - ts > CACHE_TTL;
}

function touchCacheTimestamp() {
  storageSet(STORAGE_KEYS.cacheTimestamp, Date.now());
}

/**
 * Shared hook for general products — fetches once, caches in localStorage + memory.
 * All pages that need general products use this single hook.
 */
export function useGeneralProducts() {
  const [products, setProducts] = useState<GeneralProduct[]>(() => {
    if (_generalProducts) return _generalProducts;
    const cached = storageGet<GeneralProduct[]>(STORAGE_KEYS.generalProductsCache);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      _generalProducts = cached;
      return cached;
    }
    return [];
  });
  const [loaded, setLoaded] = useState(_generalProducts !== null && _generalProducts.length > 0);

  useEffect(() => {
    // Already have fresh in-memory data
    if (_generalProducts && _generalProducts.length > 0 && !isCacheStale()) {
      setProducts(_generalProducts);
      setLoaded(true);
      return;
    }

    // Deduplicate concurrent fetches
    if (!_fetchPromises.generalProducts) {
      _fetchPromises.generalProducts = (async () => {
        try {
          const { data } = await supabase
            .from('products')
            .select('id, name, description, image_url, type, sizes, in_stock, school_id')
            .is('school_id', null)
            .eq('in_stock', true)
            .order('name');

          if (data) {
            const mapped = data.map((p) => ({
              ...p,
              sizes: Array.isArray(p.sizes) ? (p.sizes as { size: string; price: number }[]) : [],
            }));
            _generalProducts = mapped;
            storageSet(STORAGE_KEYS.generalProductsCache, mapped);
            touchCacheTimestamp();
          }
        } catch {
          // Offline — use cached
        } finally {
          delete _fetchPromises.generalProducts;
        }
      })();
    }

    _fetchPromises.generalProducts.then(() => {
      if (_generalProducts) {
        setProducts(_generalProducts);
      }
      setLoaded(true);
    });
  }, []);

  return { products, loaded };
}

/**
 * Shared hook for schools list — fetches once, caches in localStorage + memory.
 */
export function useSchoolsList() {
  const [schools, setSchools] = useState<DBSchool[]>(() => {
    if (_schools) return _schools;
    const cached = storageGet<DBSchool[]>(STORAGE_KEYS.schoolsCache);
    if (cached && Array.isArray(cached)) {
      _schools = cached;
      return cached;
    }
    return [];
  });

  useEffect(() => {
    if (_schools && _schools.length > 0 && !isCacheStale()) {
      setSchools(_schools);
      return;
    }

    if (!_fetchPromises.schools) {
      _fetchPromises.schools = (async () => {
        try {
          const { data } = await supabase
            .from('schools')
            .select('id, name, logo_url')
            .order('name');

          if (data) {
            _schools = data;
            storageSet(STORAGE_KEYS.schoolsCache, data);
            touchCacheTimestamp();
          }
        } catch {
          // Offline
        } finally {
          delete _fetchPromises.schools;
        }
      })();
    }

    _fetchPromises.schools.then(() => {
      if (_schools) setSchools(_schools);
    });
  }, []);

  return schools;
}

/**
 * Shared hook for pricing chart — fetches once, caches in localStorage + memory.
 */
export function usePricingChart() {
  const [chart, setChart] = useState<Record<string, PricingSize[]>>(() => {
    if (_pricingChart) return _pricingChart;
    const cached = storageGet<Record<string, PricingSize[]>>(STORAGE_KEYS.pricingChartCache);
    if (cached && typeof cached === 'object') {
      _pricingChart = cached;
      return cached;
    }
    return {};
  });

  useEffect(() => {
    if (_pricingChart && Object.keys(_pricingChart).length > 0 && !isCacheStale()) {
      setChart(_pricingChart);
      return;
    }

    if (!_fetchPromises.pricingChart) {
      _fetchPromises.pricingChart = (async () => {
        try {
          const { data } = await supabase
            .from('pricing_chart')
            .select('uniform_type, size, price')
            .order('uniform_type')
            .order('size');

          if (data) {
            const grouped: Record<string, PricingSize[]> = {};
            data.forEach((item: { uniform_type: string; size: string; price: number }) => {
              if (!grouped[item.uniform_type]) grouped[item.uniform_type] = [];
              grouped[item.uniform_type].push({ size: item.size, price: item.price });
            });
            _pricingChart = grouped;
            storageSet(STORAGE_KEYS.pricingChartCache, grouped);
            touchCacheTimestamp();
          }
        } catch {
          // Offline
        } finally {
          delete _fetchPromises.pricingChart;
        }
      })();
    }

    _fetchPromises.pricingChart.then(() => {
      if (_pricingChart) setChart(_pricingChart);
    });
  }, []);

  return chart;
}
