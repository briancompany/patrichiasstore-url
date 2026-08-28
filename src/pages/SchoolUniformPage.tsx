import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Phone, ArrowLeft } from 'lucide-react';
import { slugify } from '@/lib/slug';
import { ShopPriceChart } from '@/components/ShopPriceChart';

interface ProductSize {
  size: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  type: string;
  image_url: string | null;
  sizes: ProductSize[];
}

interface School {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function SchoolUniformPage() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const [school, setSchool] = useState<School | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const loadSchool = async () => {
      setIsLoading(true);
      setNotFound(false);

      const { data: schools, error } = await supabase
        .from('schools')
        .select('id, name, logo_url');

      if (error || !schools) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const match = schools.find((s) => slugify(s.name) === schoolSlug);

      if (!match) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      setSchool(match);

      const { data: productData } = await supabase
        .from('products')
        .select('id, name, type, image_url, sizes')
        .eq('school_id', match.id)
        .eq('in_stock', true)
        .order('type');

      const mapped = (productData || []).map((p) => ({
        ...p,
        sizes: (p.sizes as unknown as ProductSize[]) || [],
      }));

      setProducts(mapped);
      setIsLoading(false);
    };

    if (schoolSlug) {
      loadSchool();
    }
  }, [schoolSlug]);

  useEffect(() => {
    if (!school || !schoolSlug) return;

    const title = `${school.name} Uniform | Patrichia Kavingo Store`;
    const description = `Shop ${school.name} school uniform in Nairobi. Affordable tracksuits, T-shirts, shorts and accessories at Uhuru Market, Jogoo Road. Call +254 726 075 180.`;
    const canonicalUrl = `${window.location.origin}/uniform-shop/school/${schoolSlug}`;

    document.title = title;

    const setMeta = (selector: string, attr: string, value: string) => {
      const el = document.querySelector(selector);
      if (el) el.setAttribute(attr, value);
    };

    setMeta('meta[name="description"]', 'content', description);
    setMeta('meta[property="og:title"]', 'content', title);
    setMeta('meta[property="og:description"]', 'content', description);
    setMeta('meta[property="og:url"]', 'content', canonicalUrl);
    setMeta('meta[name="twitter:title"]', 'content', title);
    setMeta('meta[name="twitter:description"]', 'content', description);

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Give Google explicit school-page context after the page data is available.
    let jsonLd = document.getElementById('school-page-jsonld');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.id = 'school-page-jsonld';
      jsonLd.setAttribute('type', 'application/ld+json');
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      description,
      url: canonicalUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Patrichia Kavingo Uniform Store',
        url: window.location.origin,
      },
      about: {
        '@type': 'EducationalOrganization',
        name: school.name,
        ...(school.logo_url ? { logo: school.logo_url } : {}),
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin },
          { '@type': 'ListItem', position: 2, name: 'School Uniforms', item: `${window.location.origin}/uniform-shop` },
          { '@type': 'ListItem', position: 3, name: `${school.name} Uniform`, item: canonicalUrl },
        ],
      },
    });
  }, [school, schoolSlug]);

  const handleOrderThisSchool = () => {
    if (school) {
      navigate(`/uniform-shop?school=${school.id}`);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (notFound || !school) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <h1 className="text-2xl font-bold mb-3">School not found</h1>
          <p className="text-muted-foreground mb-6">
            We couldn't find that school in our system yet. Search for your school below or contact us directly.
          </p>
          <Button asChild>
            <Link to="/uniform-shop">Search Schools</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/uniform-shop">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to school search
          </Link>
        </Button>

        <div className="flex items-center gap-4 mb-6">
          {school.logo_url && (
            <img src={school.logo_url} alt={`${school.name} logo`} className="w-16 h-16 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{school.name} Uniform</h1>
            <p className="text-muted-foreground">Uhuru Market, Jogoo Road, Nairobi</p>
          </div>
        </div>

        {products.length === 0 ? (
          <Card className="border-primary/20">
            <CardContent className="py-10 px-6 text-center space-y-4">
              <Badge className="mx-auto">In Stock At Our Store</Badge>
              <p className="text-xl font-bold text-foreground">Yes! We supply {school.name} uniforms</p>
              <p className="text-muted-foreground max-w-md mx-auto">
                Photos for this school aren't posted online yet, but our shelves at Uhuru Market are stocked and ready. Most orders are fitted and ready for pickup or delivery the same day you reach out — no need to wait.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg">
                  <a href="tel:+254726075180"><Phone className="h-4 w-4 mr-2" />Call Now</a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50">
                  <a
                    href={`https://wa.me/254726075180?text=${encodeURIComponent(`Hello! I'm looking for ${school?.name} uniforms. Can you help me?`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    WhatsApp
                  </a>
                </Button>
                <Button variant="outline" size="lg" onClick={handleOrderThisSchool}>Order Online</Button>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Uhuru Market, Store F47, Jogoo Road, Nairobi · Open Mon–Sat, 8am–6pm
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((product) => (
              <Link key={product.id} to={`/shop/product/${product.id}`} className="block">
                <Card className="h-full hover:shadow-md transition-shadow">
                  {product.image_url && (
                    <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded-t-lg" loading="lazy" />
                  )}
                  <CardContent className="p-3">
                    <p className="font-medium text-sm">{product.name}</p>
                    <Badge variant="secondary" className="mt-1">{product.type}</Badge>
                    {product.sizes[0] && (
                      <p className="text-sm text-muted-foreground mt-1">From KES {product.sizes[0].price}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
            <div className="col-span-full">
              <Button onClick={handleOrderThisSchool} className="w-full">Order for {school.name}</Button>
            </div>
          </div>
        )}
        <ShopPriceChart />
      </div>
    </Layout>
  );
}
