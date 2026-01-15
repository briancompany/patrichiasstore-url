import { MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '254700000000';

export function WhatsAppButton() {
  const handleClick = () => {
    const message = encodeURIComponent("Hello Patrichia's Store! I'd like to place an order.");
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${message}`, '_blank');
  };

  return (
    <button
      onClick={handleClick}
      className="floating-whatsapp"
      aria-label="Order on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </button>
  );
}
