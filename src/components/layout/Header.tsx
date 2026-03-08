import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, User, Package, Download, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import storeLogo from '@/assets/logo-with-patrichia.png';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Shop', path: '/shop' },
  { name: 'Wishlist', path: '/wishlist' },
  { name: 'My Orders', path: '/order-history' },
  { name: 'Track Order', path: '/track-order' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

export function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (!isStandalone) {
      setIsInstallable(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      toast.info('To install: Tap the Share button, then "Add to Home Screen"', {
        duration: 5000,
      });
      return;
    }

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        toast.success('App installed successfully!');
      }
      setDeferredPrompt(null);
    } else {
      toast.info('App is ready to install from your browser menu', {
        duration: 5000,
      });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
      <div className="container-shop">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src={storeLogo} alt="Patrichia's Store" className="h-10 w-10 object-contain" />
            <span className="font-bold text-xl text-foreground">Patrichia's Store</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`${
                  location.pathname === link.path ? 'nav-link-active' : 'nav-link'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Right Icons */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Download App Button */}
            {isInstallable && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleInstallClick}
                className="text-primary hover:bg-primary/10"
                title="Install App"
              >
                <Download className="h-5 w-5" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link to="/track-order" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Track Order
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/login" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Admin Login
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <nav className="md:hidden py-4 border-t border-border animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`py-2 px-4 rounded-lg transition-colors ${
                    location.pathname === link.path
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  {link.name}
                </Link>
              ))}
              {isInstallable && (
                <button
                  onClick={() => {
                    setIsOpen(false);
                    handleInstallClick();
                  }}
                  className="py-2 px-4 rounded-lg transition-colors text-primary hover:bg-primary/10 flex items-center gap-2 text-left"
                >
                  <Download className="h-4 w-4" />
                  Install App
                </button>
              )}
              <Link
                to="/admin/login"
                onClick={() => setIsOpen(false)}
                className="py-2 px-4 rounded-lg transition-colors text-foreground hover:bg-muted flex items-center gap-2"
              >
                <User className="h-4 w-4" />
                Admin Login
              </Link>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
