import { Heart } from 'lucide-react';

interface WishlistButtonProps {
  isWishlisted: boolean;
  onToggle: () => void;
}

export function WishlistButton({ isWishlisted, onToggle }: WishlistButtonProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center transition-all hover:scale-110"
      aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
    >
      <Heart
        className={`h-4 w-4 transition-colors ${
          isWishlisted ? 'fill-red-500 text-red-500' : 'text-muted-foreground'
        }`}
      />
    </button>
  );
}
