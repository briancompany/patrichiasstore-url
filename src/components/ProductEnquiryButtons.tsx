import { MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORE_WHATSAPP = '254726075180';
const STORE_PHONE = '+254726075180';

interface ProductEnquiryButtonsProps {
  productName: string;
  size?: string | null;
  school?: string | null;
  imageUrl?: string | null;
  soldOut?: boolean;
  className?: string;
}

export function buildEnquiryLink(opts: {
  productName: string;
  size?: string | null;
  school?: string | null;
  imageUrl?: string | null;
  soldOut?: boolean;
}) {
  const lines = [
    `Hello Patrichia's Store, I would like to enquire about *${opts.productName}*.`,
    opts.school && opts.school !== 'General' ? `School: ${opts.school}` : null,
    opts.size ? `Size: ${opts.size}` : null,
    opts.soldOut ? 'I can see it is marked sold out — when will it be restocked?' : 'Is it available and what is the price?',
    opts.imageUrl && /^https?:\/\//.test(opts.imageUrl) ? `Item photo: ${opts.imageUrl}` : null,
  ].filter(Boolean) as string[];

  return `https://wa.me/${STORE_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function ProductEnquiryButtons({
  productName,
  size,
  school,
  imageUrl,
  soldOut,
  className = '',
}: ProductEnquiryButtonsProps) {
  const waLink = buildEnquiryLink({ productName, size, school, imageUrl, soldOut });

  return (
    <div className={`flex gap-2 ${className}`}>
      <Button asChild variant="outline" size="sm" className="flex-1 gap-2">
        <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label={`Enquire about ${productName} on WhatsApp`}>
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </a>
      </Button>
      <Button asChild variant="outline" size="sm" className="flex-1 gap-2">
        <a href={`tel:${STORE_PHONE}`} aria-label={`Call the store about ${productName}`}>
          <Phone className="h-4 w-4" />
          Call
        </a>
      </Button>
    </div>
  );
}