import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SchoolSearchResult {
  name: string;
  description: string;
  website?: string;
  logo?: string;
  uniformTypes: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      return new Response(JSON.stringify({ success: false, error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { query } = await req.json();

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search query must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      return new Response(JSON.stringify({ success: false, error: 'Service temporarily unavailable' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `${query} school Kenya uniforms logo`,
        limit: 5,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      return new Response(JSON.stringify({ success: false, error: 'Failed to search for schools' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: SchoolSearchResult[] = [];

    if (searchData.data && Array.isArray(searchData.data)) {
      for (const result of searchData.data.slice(0, 3)) {
        const schoolName = extractSchoolName(result.title || result.url, query);

        if (schoolName) {
          const uniformTypes = detectUniformTypes(result.markdown || result.description || '');

          results.push({
            name: schoolName,
            description: result.description || 'School found via web search',
            website: result.url,
            logo: undefined,
            uniformTypes: uniformTypes.length > 0 ? uniformTypes : ['tshirt', 'tracksuit', 'socks'],
          });
        }
      }
    }

    if (results.length > 0 && results[0].website) {
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: results[0].website,
            formats: ['branding'],
            onlyMainContent: true,
          }),
        });

        const scrapeData = await scrapeResponse.json();

        if (scrapeResponse.ok && scrapeData.data?.branding?.logo) {
          results[0].logo = scrapeData.data.branding.logo;
        } else if (scrapeResponse.ok && scrapeData.data?.branding?.images?.logo) {
          results[0].logo = scrapeData.data.branding.images.logo;
        }
      } catch {
        // Best effort logo lookup; do not leak internals.
      }
    }

    if (results.length === 0) {
      results.push({
        name: formatSchoolName(query),
        description: 'Add this school to order custom uniforms',
        uniformTypes: ['tshirt', 'tracksuit', 'socks', 'shorts', 'sweater'],
      });
    }

    return new Response(JSON.stringify({ success: true, schools: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ success: false, error: 'Failed to search schools' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function extractSchoolName(text: string, query: string): string | null {
  if (!text) return null;

  const patterns = [
    /([A-Z][a-z]+(?: [A-Z][a-z]+)* (?:Primary|Secondary|High|Academy|School|College))/g,
    /([A-Z][a-z]+ (?:Primary|Secondary|High|Academy|School|College))/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0];
    }
  }

  return formatSchoolName(query);
}

function formatSchoolName(query: string): string {
  return query
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function detectUniformTypes(content: string): string[] {
  const types: string[] = [];
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('t-shirt') || lowerContent.includes('tshirt') || lowerContent.includes('shirt')) types.push('tshirt');
  if (lowerContent.includes('tracksuit') || lowerContent.includes('track suit') || lowerContent.includes('sports')) types.push('tracksuit');
  if (lowerContent.includes('socks') || lowerContent.includes('sock')) types.push('socks');
  if (lowerContent.includes('shorts') || lowerContent.includes('short')) types.push('shorts');
  if (lowerContent.includes('skirt') || lowerContent.includes('tunic')) types.push('skirt');
  if (lowerContent.includes('sweater') || lowerContent.includes('jumper') || lowerContent.includes('pullover')) types.push('sweater');

  return types;
}
