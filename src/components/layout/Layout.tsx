import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppButton } from '../WhatsAppButton';
import { FlashSaleAlert } from '../FlashSaleAlert';
import { ChatAssistant } from '../ChatAssistant';
import { MobileBottomNav } from './MobileBottomNav';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-w-0 max-w-full mx-auto min-h-screen flex flex-col">
      <Header />
      {/* Reserve the fixed header's space so it never covers page content. */}
      <div aria-hidden="true" className="h-[4.5rem] shrink-0" />
      <FlashSaleAlert />
      <main className="store-page w-full min-w-0 flex-1 pb-8">{children}</main>
      <Footer />
      <MobileBottomNav />
      <WhatsAppButton />
      <ChatAssistant />
    </div>
  );
}
