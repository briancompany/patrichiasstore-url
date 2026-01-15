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
    const { query } = await req.json();

    if (!query || query.length < 3) {
      return new Response(
        JSON.stringify({ success: false, error: 'Search query must be at least 3 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'School search not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Searching for school:', query);

    // Search for the school using Firecrawl
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
      console.error('Firecrawl search error:', searchData);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to search for schools' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process search results to extract school info
    const results: SchoolSearchResult[] = [];

    if (searchData.data && Array.isArray(searchData.data)) {
      for (const result of searchData.data.slice(0, 3)) {
        // Try to extract school name from title or URL
        const schoolName = extractSchoolName(result.title || result.url, query);
        
        if (schoolName) {
          // Determine uniform types based on content
          const uniformTypes = detectUniformTypes(result.markdown || result.description || '');
          
          results.push({
            name: schoolName,
            description: result.description || 'School found via web search',
            website: result.url,
            logo: undefined, // Will try to find in scrape
            uniformTypes: uniformTypes.length > 0 ? uniformTypes : ['tshirt', 'tracksuit', 'socks'],
          });
        }
      }
    }

    // If we found results, try to get logo from first school's website
    if (results.length > 0 && results[0].website) {
      try {
        const scrapeResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
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
      } catch (brandingError) {
        console.log('Could not fetch branding, continuing without logo:', brandingError);
      }
    }

    // If no results from web search, create a generic entry for the queried school
    if (results.length === 0) {
      results.push({
        name: formatSchoolName(query),
        description: 'Add this school to order custom uniforms',
        uniformTypes: ['tshirt', 'tracksuit', 'socks', 'shorts', 'sweater'],
      });
    }

    console.log('Search results:', results.length, 'schools found');

    return new Response(
      JSON.stringify({ success: true, schools: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching schools:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to search';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractSchoolName(text: string, query: string): string | null {
  if (!text) return null;
  
  // Common patterns for school names
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

  // If no pattern match, use the query as the school name
  return formatSchoolName(query);
}

function formatSchoolName(query: string): string {
  // Capitalize first letter of each word
  return query
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function detectUniformTypes(content: string): string[] {
  const types: string[] = [];
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('t-shirt') || lowerContent.includes('tshirt') || lowerContent.includes('shirt')) {
    types.push('tshirt');
  }
  if (lowerContent.includes('tracksuit') || lowerContent.includes('track suit') || lowerContent.includes('sports')) {
    types.push('tracksuit');
  }
  if (lowerContent.includes('socks') || lowerContent.includes('sock')) {
    types.push('socks');
  }
  if (lowerContent.includes('shorts') || lowerContent.includes('short')) {
    types.push('shorts');
  }
  if (lowerContent.includes('skirt') || lowerContent.includes('tunic')) {
    types.push('skirt');
  }
  if (lowerContent.includes('sweater') || lowerContent.includes('jumper') || lowerContent.includes('pullover')) {
    types.push('sweater');
  }

  return types;
}
