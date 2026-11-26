import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { CategoryCard } from '@/components/CategoryCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { Shirt, Activity, Footprints, CheckCircle, Truck, CreditCard, Quote } from 'lucide-react';
import patrichiaImage from '@/assets/patrichia-optimized.webp';
import { prefetchStoreData } from '@/hooks/useProductCache';
import { FlashSaleBanner } from '@/components/FlashSaleBanner';
import { AdBanner } from '@/components/AdBanner';

const categories = [
  {
    title: 'School T-Shirts',
    description: 'Quality cotton T-shirts with school logos',
    icon: Shirt,
    href: '/shop?type=tshirt',
  },
  {
    title: 'Tracksuits',
    description: 'Durable PE and sports tracksuits',
    icon: Activity,
    href: '/shop?type=tracksuit',
  },
  {
    title: 'Socks & More',
    description: 'School socks, shorts, and accessories',
    icon: Footprints,
    href: '/shop?type=socks',
  },
];

const features = [
  {
    icon: CheckCircle,
    title: 'Quality Guaranteed',
    description: 'All uniforms are durable and well-made',
  },
  {
    icon: CreditCard,
    title: 'Affordable Prices',
    description: 'Best prices in Uhuru Market',
  },
  {
    icon: Truck,
    title: 'Pickup or Delivery',
    description: 'Get your order your way',
  },
];

export default function Index() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  // Warm the product + school caches while the visitor reads the homepage,
  // so opening the Shop is instant on a first visit.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(() => prefetchStoreData());
    else setTimeout(() => prefetchStoreData(), 400);
  }, []);

  return (

    <Layout>
      {/* Hero Section */}
      <section className="relative store-home-hero overflow-hidden mx-3 mt-3 rounded-[2rem] border border-white/70 shadow-xl">
        <div className="absolute inset-0 z-0">
          <img
            src="/hero-uniforms.webp"
            alt=""
            width={1600}
            height={900}
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover opacity-40"
          />
        </div>
        <div className="relative z-10 container-shop py-16 md:py-24">
          <div className="max-w-3xl mr-auto text-left space-y-5">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-white drop-shadow-lg animate-fade-in">
              Patrichia Kavingo Uniform Store
            </h1>
            <p className="text-xl md:text-2xl text-white/95 drop-shadow animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Affordable School Uniforms, Tracksuits & Clothes in Nairobi
            </p>
            <p className="text-base md:text-lg text-white/85 drop-shadow animate-fade-in" style={{ animationDelay: '0.2s' }}>
              We are located at Uhuru Market, Jogoo Road, Nairobi (Store F47) • Serving all Kenyan schools
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button asChild size="lg" className="store-button-gold text-lg px-8">
                <Link to="/shop">Shop Now</Link>
              </Button>
              <Button asChild size="lg" className="store-button-primary text-lg px-8">
                <Link to="/order">Place Order</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-20 -mt-7 px-4" aria-label="Search products">
        <form
          className="store-surface mx-auto flex w-full max-w-3xl items-center gap-2 rounded-full p-2"
          onSubmit={(event) => {
            event.preventDefault();
            const query = searchQuery.trim();
            navigate(query ? `/shop?search=${encodeURIComponent(query)}` : '/shop');
          }}
        >
          <Search className="ml-3 h-5 w-5 shrink-0 text-primary" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search school uniforms, sweaters, socks..."
            className="h-12 border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="Search products"
          />
          <Button type="submit" className="store-button-primary shrink-0 px-6">Search</Button>
        </form>
      </section>

      <section className="py-8 bg-background" aria-label="Live flash sales">
        <div className="container-shop">
          <FlashSaleBanner />
          <AdBanner placement="home" className="mt-6" />
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-background">
        <div className="container-shop">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Our Uniform Categories</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Browse our wide selection of quality school uniforms for all ages
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {categories.map((category) => (
              <CategoryCard key={category.title} {...category} />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted">
        <div className="container-shop">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">Why Choose Us?</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <feature.icon className="h-8 w-8 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Meet Patrichia Section */}
      <section className="py-16 bg-gradient-to-br from-primary/5 to-secondary/10">
        <div className="container-shop">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              {/* Image */}
              <div className="relative">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-4 border-background">
                  <img
                    src={patrichiaImage}
                    alt="Patrichia - Store Owner"
                    width={864}
                    height={1184}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-4 -right-4 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg">
                  <p className="font-bold text-lg">10+ Years</p>
                  <p className="text-sm opacity-90">of Service</p>
                </div>
              </div>
              
              {/* Content */}
              <div className="space-y-6">
                <div>
                  <p className="text-primary font-semibold mb-2">Meet The Owner</p>
                  <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                    Patrichia Kavingo
                  </h2>
                </div>
                
                <div className="relative">
                  <Quote className="h-8 w-8 text-primary/30 absolute -top-2 -left-2" />
                  <p className="text-lg text-muted-foreground italic pl-8">
                    "Every child deserves quality uniforms that make them feel confident and ready to learn. 
                    That's why I've dedicated my life to providing the best school uniforms at prices families can afford."
                  </p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-foreground">Serving schools across Kenya</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-foreground">Trusted by thousands of parents</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-primary" />
                    </div>
                    <p className="text-foreground">Located at Uhuru Market, Store F47</p>
                  </div>
                </div>
                
                <Button asChild size="lg" className="btn-primary">
                  <Link to="/shop">Shop With Patrichia</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-secondary/10">
        <div className="container-shop text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Order?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Browse our collection, select your items, and place your order through WhatsApp. It's that easy!
          </p>
          <Button asChild size="lg" className="btn-secondary text-lg px-8">
            <Link to="/shop">Browse All Uniforms</Link>
          </Button>
        </div>
      </section>

      {/* Local SEO Section */}
      <section className="py-12 bg-background border-t">
        <div className="container-shop max-w-4xl">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            School Uniforms & Tracksuits at Uhuru Market, Nairobi
          </h2>
          <div className="space-y-3 text-muted-foreground">
            <p>
              Looking for affordable <strong>school uniforms in Nairobi</strong>? Patrichia Kavingo
              Uniform Store is your trusted shop for quality <strong>uniforms, tracksuits and
              clothes at Uhuru Market</strong>, Jogoo Road. We supply schools across Kenya with
              durable, well-stitched uniforms at prices families can afford.
            </p>
            <p>
              Visit us at <strong>Uhuru Market, Store F47, Jogoo Road, Nairobi</strong>, or call
              <a href="tel:+254726075180" className="text-primary font-medium"> +254 726 075 180</a>
              {' '}to place an order. We stock <Link to="/shop?type=tshirt" className="text-primary underline">school t-shirts</Link>,
              {' '}<Link to="/shop?type=tracksuit" className="text-primary underline">affordable tracksuits</Link>,
              {' '}<Link to="/shop?type=socks" className="text-primary underline">socks and accessories</Link>,
              and branded clothing for primary and secondary schools.
            </p>
            <p>
              Popular searches: <em>uniforms Uhuru Market Nairobi, school uniforms Nairobi,
              tracksuits Jogoo Road, clothes Uhuru Market, affordable tracksuits Kenya.</em>
            </p>
          </div>
        </div>
      </section>
    </Layout>
  );
}
