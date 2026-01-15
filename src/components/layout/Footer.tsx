import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, ShoppingBag } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="container-shop py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <ShoppingBag className="h-8 w-8" />
              <span className="font-bold text-xl">Patrichia's Store</span>
            </div>
            <p className="text-primary-foreground/80">
              Quality school uniforms at affordable prices. Serving Kenyan schools with pride.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Quick Links</h3>
            <div className="flex flex-col gap-2">
              <Link to="/shop" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                Shop Uniforms
              </Link>
              <Link to="/order" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                Place Order
              </Link>
              <Link to="/about" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                About Us
              </Link>
              <Link to="/contact" className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
                Contact
              </Link>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-lg mb-4">Contact Us</h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <span className="text-primary-foreground/80">
                  Uhuru Market, Store F47<br />
                  Nairobi, Kenya
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 flex-shrink-0" />
                <span className="text-primary-foreground/80">+254 700 000 000</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <span className="text-primary-foreground/80">Mon - Sat: 8AM - 6PM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-primary-foreground/60">
          <p>© {new Date().getFullYear()} Patrichia's Store. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
