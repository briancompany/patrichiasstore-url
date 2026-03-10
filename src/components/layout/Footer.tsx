import { Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Mail, Code, Star } from 'lucide-react';
import { DeveloperProfileDialog } from '../DeveloperProfileDialog';
import storeLogo from '@/assets/logo-with-patrichia.png';
import developerImage from '@/assets/developer-brian.jpg';

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground mt-auto">
      <div className="container-shop py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src={storeLogo} alt="Patrichia's Store" className="h-10 w-10 object-contain" />
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
                <span className="text-primary-foreground/80">+254 726 075 180</span>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 flex-shrink-0" />
                <span className="text-primary-foreground/80">Mon - Sat: 8AM - 6PM</span>
              </div>
              {/* Google Review */}
              <a
                href="https://g.page/r/CfxttwFIeWTmEAE/review"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 bg-accent/20 hover:bg-accent/30 text-primary-foreground px-4 py-2 rounded-lg transition-colors"
              >
                <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium">Leave us a Google Review</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-8 pt-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-primary-foreground/60">
              © {new Date().getFullYear()} Patrichia's Store. All rights reserved.
            </p>
            
            {/* Developer Credit */}
            <div className="bg-primary-foreground/10 rounded-lg p-4 max-w-md">
              <div className="flex items-center gap-4 mb-3">
                <img 
                  src={developerImage} 
                  alt="Brian Mutie - Web Developer" 
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary-foreground/30"
                />
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <Code className="h-4 w-4 text-primary-foreground/80" />
                    <span className="font-medium text-primary-foreground/90">
                      Brian Mutie
                    </span>
                  </div>
                  <p className="text-sm text-primary-foreground/70">
                    Professional Web Developer
                  </p>
                  <p className="text-xs text-primary-foreground/60">
                    Digital Business Solutions
                  </p>
                </div>
              </div>
              <p className="text-xs text-primary-foreground/60 mb-3 text-center">
                I create clean, fast, and user-friendly websites that help businesses grow and operate smoothly online.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-sm">
                <a 
                  href="mailto:brianmutie777@gmail.com" 
                  className="flex items-center gap-1 text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  brianmutie777@gmail.com
                </a>
                <DeveloperProfileDialog />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}