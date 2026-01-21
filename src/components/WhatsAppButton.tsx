import { MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '254726075180';

export function WhatsAppButton() {
  const handleClick = () => {
    const message = encodeURIComponent("Hello Patrichia's Store! I'd like to place an order.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className="fixed bottom-24 md:bottom-6 right-4 md:right-6 z-40 w-14 h-14 rounded-full bg-whatsapp text-whatsapp-foreground hover:bg-whatsapp/90 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center animate-bounce-gentle"
      aria-label="Order on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </button>
  );
}