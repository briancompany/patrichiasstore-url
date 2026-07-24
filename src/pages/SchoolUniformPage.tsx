import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Phone, ArrowLeft } from 'lucide-react';
import { slugify } from '@/lib/slug';

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
    if (school) {
      const title = `${school.name} Uniform | Patrichia Kavingo Store`;
      const description = `Shop ${school.name} school uniform in Nairobi. Affordable tracksuits, T-shirts, shorts and accessories at Uhuru Market, Jogoo Road. Call +254 726 075 180.`;

      document.title = title;

      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) metaDesc.setAttribute('content', description);

      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) ogTitle.setAttribute('content', title);

      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) ogDesc.setAttribute('content', description);

      const ogUrl = document.querySelector('meta[property="og:url"]');
      if (ogUrl) ogUrl.setAttribute('content', window.location.href);

      const twTitle = document.querySelector('meta[name="twitter:title"]');
      if (twTitle) twTitle.setAttribute('content', title);

      const twDesc = document.querySelector('meta[name="twitter:description"]');
      if (twDesc) twDesc.setAttribute('content', description);

      let canonical = document.querySelector('link[rel="canonical"]');
      if (canonical) canonical.setAttribute('href', window.location.href);
    }
  }, [school]);

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
              <p className="text-xl font-bold text-foreground">
                Yes! We supply {school.name} uniforms
              </p>
              <p className="text-muted-foreground max-w-md mx-auto">
                Photos for this school aren't posted online yet, but our shelves at Uhuru Market are stocked and ready. Most orders are fitted and ready for pickup or delivery the same day you reach out — no need to wait.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button asChild size="lg">
                  <a href="tel:+254726075180">
                    <Phone className="h-4 w-4 mr-2" />
                    Call / WhatsApp Now
                  </a>
                </Button>
                <Button variant="outline" size="lg" onClick={handleOrderThisSchool}>
                  Order Online Instead
                </Button>
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                Uhuru Market, Store F47, Jogoo Road, Nairobi &middot; Open Mon&ndash;Sat, 8am&ndash;6pm
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((product) => (
              <Card key={product.id}>
                {product.image_url && (
                  <img src={product.image_url} alt={product.name} className="w-full h-32 object-cover rounded-t-lg" />
                )}
                <CardContent className="p-3">
                  <p className="font-medium text-sm">{product.name}</p>
                  <Badge variant="secondary" className="mt-1">
                    {product.type}
                  </Badge>
                  {product.sizes[0] && (
                    <p className="text-sm text-muted-foreground mt-1">From KES {product.sizes[0].price}</p>
                  )}
                </CardContent>
              </Card>
            ))}
            <div className="col-span-full">
              <Button onClick={handleOrderThisSchool} className="w-full">
                Order for {school.name}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
