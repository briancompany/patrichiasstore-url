import { Layout } from '@/components/layout/Layout';
import { Users, Award, Heart, MapPin } from 'lucide-react';

const values = [
  {
    icon: Award,
    title: 'Quality First',
    description: 'We source only the best materials to ensure our uniforms last the entire school year and beyond.',
  },
  {
    icon: Heart,
    title: 'Customer Care',
    description: 'Every parent and student matters to us. We provide personalized service for every order.',
  },
  {
    icon: Users,
    title: 'Community Focus',
    description: 'We proudly serve Kenyan schools and families, understanding local needs and preferences.',
  },
];

export default function About() {
  return (
    <Layout>
      <div className="container-shop py-8">
        {/* Hero */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">About Patrichia's Store</h1>
          <p className="text-lg text-muted-foreground">
            Your trusted partner for quality school uniforms in Nairobi
          </p>
        </div>

        {/* Story */}
        <div className="max-w-3xl mx-auto mb-16">
          <div className="bg-card rounded-xl p-8 border border-border">
            <h2 className="text-2xl font-bold text-foreground mb-4">Our Story</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Patrichia's Store was founded with a simple mission: to provide quality school uniforms 
                at affordable prices for Kenyan families. Located in the heart of Uhuru Market at Store F47, 
                we have been serving parents and students for years.
              </p>
              <p>
                We understand that school uniforms are an essential part of a child's education. That's why 
                we take pride in offering durable, well-made uniforms that can withstand the rigors of daily 
                school life while keeping students looking smart and professional.
              </p>
              <p>
                From T-shirts and tracksuits to socks and sweaters, we stock uniforms for numerous schools 
                across Nairobi. Our friendly team is always ready to help you find the perfect fit for your 
                child.
              </p>
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map((value) => (
              <div key={value.title} className="bg-card rounded-xl p-6 border border-border text-center">
                <div className="w-14 h-14 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
                  <value.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">{value.title}</h3>
                <p className="text-muted-foreground">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="max-w-3xl mx-auto">
          <div className="bg-primary/5 rounded-xl p-8 text-center">
            <MapPin className="h-12 w-12 mx-auto text-primary mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Visit Us</h2>
            <p className="text-lg text-muted-foreground mb-2">
              <strong>Uhuru Market, Store F47</strong>
            </p>
            <p className="text-muted-foreground">
              Open Monday to Saturday, 8:00 AM - 6:00 PM
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}
