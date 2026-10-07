import { ReactNode } from 'react';
import { Header } from './Header';
import { Footer } from './Footer';
import { WhatsAppButton } from '../WhatsAppButton';
import { FlashSaleAlert } from '../FlashSaleAlert';
import { ChatAssistant } from '../ChatAssistant';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-w-0 max-w-full mx-auto min-h-screen flex flex-col">
      <FlashSaleAlert />
      <Header />
      <main className="w-full min-w-0 flex-1">{children}</main>
      <Footer />
      <WhatsAppButton />
      <ChatAssistant />
    </div>
  );
}
