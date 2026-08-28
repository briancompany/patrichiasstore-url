import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Phone, ArrowLeft, ShoppingCart } from 'lucide-react';
import { ShopPriceChart } from '@/components/ShopPriceChart';
import { slugify } from '@/lib/slug';

interface ProductSize {
  size: string;
  price: number;
}

interface Product {
  id: string;
  name: string;
  type: string;
  description: string | null;
  image_url: string | null;
  sizes: ProductSize[];
  in_stock: boolean;
  school_id: string | null;
  schools?: { id: string; name: string; logo_url: string | null } | null;
}

export default function ProductPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!productId) return;
      setIsLoading(true);

      const { data, error } = await supabase
        .from('products')
        .select('*, schools(id, name, logo_url)')
        .eq('id', productId)
        .single();

      if (error || !data) {
        setNotFound(true);
        setIsLoading(false);
        return;
      }

      const p: Product = {
        ...data,
        sizes: (data.sizes as unknown as ProductSize[]) || [],
      };

      setProduct(p);
      setIsLoading(false);
    };

    load();
  }, [productId]);

  useEffect(() => {
    if (!product || !productId) return;

    const schoolName = product.schools?.name;
    const title = schoolName
      ? `${schoolName} ${product.name} | Patrichia Kavingo Store`
      : `${product.name} | School Uniform | Patrichia Kavingo Store`;

    const lowestPrice = product.sizes.length > 0
      ? Math.min(...product.sizes.map((s) => s.price))
      : null;

    const description = schoolName
      ? `Buy ${schoolName} ${product.name} at Uhuru Market, Jogoo Road Nairobi. ${lowestPrice ? `From KES ${lowestPrice}. ` : ''}Available in-store at Patrichia Kavingo Store F47. Call +254 726 075 180.`
      : `Buy ${product.name} school uniform in Nairobi at Uhuru Market. ${lowestPrice ? `From KES ${lowestPrice}. ` : ''}Patrichia Kavingo Store F47, Jogoo Road. Call +254 726 075 180.`;

    const canonicalUrl = `${window.location.origin}/shop/product/${productId}`;

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

    if (product.image_url) {
      setMeta('meta[property="og:image"]', 'content', product.image_url);
      setMeta('meta[name="twitter:image"]', 'content', product.image_url);
    }

    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Product + breadcrumb structured data helps search engines understand the landing page.
    let jsonLd = document.getElementById('product-page-jsonld');
    if (!jsonLd) {
      jsonLd = document.createElement('script');
      jsonLd.id = 'product-page-jsonld';
      jsonLd.setAttribute('type', 'application/ld+json');
      document.head.appendChild(jsonLd);
    }
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      description: product.description || description,
      ...(product.image_url ? { image: [product.image_url] } : {}),
      ...(schoolName ? { brand: { '@type': 'Brand', name: schoolName } } : {}),
      offers: {
        '@type': 'Offer',
        url: canonicalUrl,
        priceCurrency: 'KES',
        ...(lowestPrice !== null ? { price: lowestPrice } : {}),
        availability: product.in_stock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: {
          '@type': 'ClothingStore',
          name: 'Patrichia Kavingo Uniform Store',
          url: window.location.origin,
        },
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: window.location.origin },
          { '@type': 'ListItem', position: 2, name: 'School Uniforms', item: `${window.location.origin}/uniform-shop` },
          ...(schoolName
            ? [{ '@type': 'ListItem', position: 3, name: `${schoolName} Uniform`, item: `${window.location.origin}/uniform-shop/school/${slugify(schoolName)}` }]
            : []),
          { '@type': 'ListItem', position: schoolName ? 4 : 3, name: product.name, item: canonicalUrl },
        ],
      },
    });
  }, [product, productId]);

  const handleOrder = () => {
    if (product?.school_id) {
      navigate(`/uniform-shop?school=${product.school_id}`);
    } else {
      navigate('/shop');
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

  if (notFound || !product) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-16 text-center px-4">
          <h1 className="text-2xl font-bold mb-3">Product not found</h1>
          <p className="text-muted-foreground mb-6">This product may no longer be available. Browse our full shop instead.</p>
          <Button asChild><Link to="/shop">Back to Shop</Link></Button>
        </div>
      </Layout>
    );
  }

  const lowestPrice = product.sizes.length > 0
    ? Math.min(...product.sizes.map((s) => s.price))
    : null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto py-10 px-4">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to={product.schools ? `/uniform-shop/school/${slugify(product.schools.name)}` : '/shop'}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {product.schools ? `Back to ${product.schools.name}` : 'Back to Shop'}
          </Link>
        </Button>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full rounded-xl object-cover aspect-square" />
            ) : (
              <div className="w-full rounded-xl bg-muted aspect-square flex items-center justify-center">
                <p className="text-muted-foreground text-sm">No photo yet</p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {product.schools && (
              <p className="text-sm text-muted-foreground font-medium">{product.schools.name}</p>
            )}
            <h1 className="text-2xl font-bold text-foreground">{product.name}</h1>
            <Badge variant="secondary">{product.type}</Badge>

            {product.description && <p className="text-muted-foreground">{product.description}</p>}

            {lowestPrice && <p className="text-xl font-bold text-primary">From KES {lowestPrice.toLocaleString()}</p>}

            {product.sizes.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">Available sizes & prices:</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => (
                    <div key={s.size} className="border rounded-lg px-3 py-1 text-sm">
                      <span className="font-medium">{s.size}</span>
                      <span className="text-muted-foreground ml-1">KES {s.price.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Card className="border-primary/20 mt-4">
              <CardContent className="py-4 space-y-3">
                <p className="text-sm font-medium">Available in-store & online — Uhuru Market, Store F47, Jogoo Road</p>
                <div className="flex flex-col gap-2">
                  <Button asChild size="lg" className="w-full"><a href="tel:+254726075180"><Phone className="h-4 w-4 mr-2" />Call / WhatsApp to Order</a></Button>
                  <Button variant="outline" size="lg" className="w-full" onClick={handleOrder}><ShoppingCart className="h-4 w-4 mr-2" />Order Online</Button>
                </div>
                <p className="text-xs text-muted-foreground text-center">Open Mon–Sat, 8am–6pm · Countrywide delivery available</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <ShopPriceChart />
      </div>
    </Layout>
  );
}
