import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ZoomIn } from 'lucide-react';

interface ProductImageZoomProps {
  src: string;
  alt: string;
  className?: string;
}

export function ProductImageZoom({ src, alt, className = '' }: ProductImageZoomProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`group relative block w-full cursor-zoom-in overflow-hidden rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`}
          aria-label={`Enlarge product photo: ${alt}`}
        >
          <img src={src} alt={alt} className="h-full w-full object-cover" loading="lazy" decoding="async" />
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-background/95 px-3 py-2 text-xs font-semibold text-foreground shadow-md">
            <ZoomIn className="h-4 w-4" /> Tap to zoom
          </span>
        </button>
      </DialogTrigger>
      <DialogContent className="!fixed !inset-0 !left-0 !top-0 !z-[100] !h-[100dvh] !w-screen !max-w-none !translate-x-0 !translate-y-0 !gap-2 !rounded-none !border-0 !bg-black/95 !p-3 text-white">
        <DialogTitle className="pr-10 text-left text-sm font-semibold text-white">{alt}</DialogTitle>
        <DialogDescription className="text-xs text-white/75">
          Pinch with two fingers to zoom. Use the close button to return to the product.
        </DialogDescription>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
          <img
            src={src}
            alt={alt}
            className="max-h-full max-w-full select-none object-contain"
            style={{ touchAction: 'pinch-zoom' }}
            draggable={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
