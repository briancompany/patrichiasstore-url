import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Grid2X2, Heart, ClipboardList, ShoppingCart } from 'lucide-react';
import { STORAGE_KEYS, storageGet } from '@/lib/persist';
import type { CartItem } from '@/types/product';

const links = [
  { label: 'Home', path: '/', icon: Home },
  { label: 'Categories', path: '/shop', icon: Grid2X2 },
  { label: 'Wishlist', path: '/wishlist', icon: Heart },
  { label: 'My Orders', path: '/order-history', icon: ClipboardList },
  { label: 'Cart', path: '/order', icon: ShoppingCart },
];

function readCartCount() {
  const cart = storageGet<CartItem[]>(STORAGE_KEYS.shopCart) ?? [];
  return cart.reduce((total, item) => total + Math.max(0, Number(item.quantity) || 0), 0);
}

export function MobileBottomNav() {
  const location = useLocation();
  const [cartCount, setCartCount] = useState(readCartCount);

  useEffect(() => {
    const refresh = () => setCartCount(readCartCount());
    window.addEventListener('storage', refresh);
    window.addEventListener('ps-cart-updated', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('ps-cart-updated', refresh);
    };
  }, []);

  return (
    <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-[55] border-t border-border/80 bg-white/95 shadow-[0_-8px_24px_rgba(15,35,75,0.10)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {links.map(({ label, path, icon: Icon }) => {
          const active = path === '/'
            ? location.pathname === '/'
            : path === '/shop'
              ? location.pathname === '/shop' || location.pathname.startsWith('/uniform-shop')
              : location.pathname === path || (path === '/order' && location.pathname === '/checkout');
          return (
            <Link key={path} to={path} aria-current={active ? 'page' : undefined}
              className={`relative flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors ${
                active ? 'text-primary' : 'text-muted-foreground hover:text-primary'
              }`}>
              <span className={`relative flex h-7 w-9 items-center justify-center rounded-full ${
                active ? 'bg-primary/10' : ''
              }`}>
                <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                {path === '/order' && cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-white">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </span>
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
