import { Link } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { CategoryCard } from '@/components/CategoryCard';
import { Button } from '@/components/ui/button';
import { Shirt, Activity, Footprints, CheckCircle, Truck, CreditCard, Quote } from 'lucide-react';
import heroImage from '@/assets/hero-uniforms.jpg';
import patrichiaImage from '@/assets/patrichia-optimized.jpg';

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
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative bg-primary overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage} 
            alt="School uniforms" 
            className="w-full h-full object-cover opacity-20"
          />
        </div>
        <div className="relative z-10 container-shop py-16 md:py-24">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-primary-foreground animate-fade-in">
              Patrichia's Store
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Quality School Uniforms at Affordable Prices
            </p>
            <p className="text-lg text-primary-foreground/80 animate-fade-in" style={{ animationDelay: '0.2s' }}>
              Located at Uhuru Market, Store F47 • Serving all Kenyan schools
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <Button asChild size="lg" className="bg-secondary hover:bg-secondary/90 text-secondary-foreground text-lg px-8">
                <Link to="/shop">Shop Now</Link>
              </Button>
              <Button asChild size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 shadow-lg">
                <Link to="/order">Place Order</Link>
              </Button>
            </div>
          </div>
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
    </Layout>
  );
}
