import { supabase } from '@/integrations/supabase/client';

export interface DBSchoolResult {
  id: string;
  name: string;
  logo_url: string | null;
  isFromDB: true;
}

export type SchoolResult = DBSchoolResult;

export async function searchSchoolsFromDB(query: string): Promise<DBSchoolResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const { data, error } = await supabase
    .from('schools')
    .select('id, name, logo_url')
    .ilike('name', `%${query}%`)
    .limit(10);

  if (error) {
    console.error('Error fetching schools from DB:', error);
    return [];
  }

  return (data || []).map(school => ({
    ...school,
    isFromDB: true as const,
  }));
}

export async function searchSchools(query: string): Promise<SchoolResult[]> {
  return searchSchoolsFromDB(query);
}
