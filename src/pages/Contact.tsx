import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, Phone, Clock, MessageCircle } from 'lucide-react';
import { useState } from 'react';

const WHATSAPP_NUMBER = '254700000000';

const contactInfo = [
  {
    icon: MapPin,
    title: 'Location',
    details: ['Uhuru Market, Store F47', 'Nairobi, Kenya'],
  },
  {
    icon: Phone,
    title: 'Phone',
    details: ['+254 700 000 000'],
  },
  {
    icon: Clock,
    title: 'Opening Hours',
    details: ['Monday - Saturday', '8:00 AM - 6:00 PM'],
  },
];

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    message: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent(
      `Hello Patrichia's Store!\n\nMy name is ${formData.name}.\nPhone: ${formData.phone}\n\n${formData.message}`
    );
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  const handleDirectWhatsApp = () => {
    const message = encodeURIComponent("Hello Patrichia's Store! I have a question.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-foreground mb-4">Contact Us</h1>
            <p className="text-lg text-muted-foreground">
              Have questions? We're here to help!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Contact Info */}
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Get in Touch</h2>
              
              <div className="space-y-4">
                {contactInfo.map((info) => (
                  <div key={info.title} className="flex items-start gap-4 p-4 bg-card rounded-xl border border-border">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <info.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{info.title}</h3>
                      {info.details.map((detail, index) => (
                        <p key={index} className="text-muted-foreground">{detail}</p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick WhatsApp */}
              <Button onClick={handleDirectWhatsApp} className="w-full btn-whatsapp gap-2 h-12">
                <MessageCircle className="h-5 w-5" />
                Chat on WhatsApp
              </Button>
            </div>

            {/* Contact Form */}
            <div className="bg-card rounded-xl p-6 border border-border">
              <h2 className="text-2xl font-bold text-foreground mb-6">Send a Message</h2>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Your Name</Label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="Enter your name"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="e.g., 0712345678"
                  />
                </div>

                <div>
                  <Label htmlFor="message">Your Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    placeholder="How can we help you?"
                    rows={4}
                  />
                </div>

                <Button
                  onClick={handleWhatsAppContact}
                  disabled={!formData.name || !formData.message}
                  className="w-full btn-primary h-12"
                >
                  Send via WhatsApp
                </Button>

                <p className="text-sm text-muted-foreground text-center">
                  Your message will be sent through WhatsApp for a faster response.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
