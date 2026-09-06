import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppButton } from '../WhatsAppButton';
import { FlashSaleAlert } from '../FlashSaleAlert';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <FlashSaleAlert />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
    </div>
  );
}
