import { supabase } from '@/integrations/supabase/client';

export interface WebSchoolResult {
  name: string;
  description: string;
  website?: string;
  logo?: string;
  uniformTypes: string[];
  isFromWeb: true;
}

export interface DBSchoolResult {
  id: string;
  name: string;
  logo_url: string | null;
  isFromWeb: false;
}

export type SchoolResult = WebSchoolResult | DBSchoolResult;

export async function searchSchoolsFromWeb(query: string): Promise<WebSchoolResult[]> {
  if (!query || query.length < 3) {
    return [];
  }

  try {
    const { data, error } = await supabase.functions.invoke('search-school', {
      body: { query },
    });

    if (error) {
      console.error('Error searching schools:', error);
      return [];
    }

    if (data.success && data.schools) {
      return data.schools.map((school: Omit<WebSchoolResult, 'isFromWeb'>) => ({
        ...school,
        isFromWeb: true as const,
      }));
    }

    return [];
  } catch (error) {
    console.error('Error calling search-school function:', error);
    return [];
  }
}

export async function searchSchoolsFromDB(query: string): Promise<DBSchoolResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, logo_url')
    .ilike('name', `%${query}%`)
    .limit(5);

  if (error) {
    console.error('Error fetching schools from DB:', error);
    return [];
  }

  return (data || []).map(school => ({
    ...school,
    isFromWeb: false as const,
  }));
}

export async function searchSchools(query: string): Promise<SchoolResult[]> {
  // First, check local database
  const dbSchools = await searchSchoolsFromDB(query);
  
  // If we have matches in DB, return them first
  if (dbSchools.length > 0) {
    return dbSchools;
  }

  // Otherwise, search the web
  const webSchools = await searchSchoolsFromWeb(query);
  return webSchools;
}
