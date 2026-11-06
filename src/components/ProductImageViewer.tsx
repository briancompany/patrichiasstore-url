import { useState } from 'react';
import { Minus, Plus, RotateCcw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ProductImageViewerProps {
  src: string;
  alt: string;
  imageClassName?: string;
  containerClassName?: string;
  loading?: 'eager' | 'lazy';
}

/** Accessible product photo viewer with responsive, controllable zoom. */
export function ProductImageViewer({
  src,
  alt,
  imageClassName = 'h-full w-full object-cover',
  containerClassName = 'block h-full w-full',
  loading = 'lazy',
}: ProductImageViewerProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);

  const closeViewer = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) setScale(1);
  };

  const zoomIn = () => setScale((value) => Math.min(4, Number((value + 0.5).toFixed(1))));
  const zoomOut = () => setScale((value) => Math.max(1, Number((value - 0.5).toFixed(1))));

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={containerClassName + ' cursor-zoom-in text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary'}
        aria-label={`Enlarge photo: ${alt}`}
      >
        <img
          src={src}
          alt={alt}
          className={imageClassName}
          loading={loading}
          decoding="async"
        />
        <span className="sr-only">Tap to enlarge product photo</span>
      </button>

      <Dialog open={open} onOpenChange={closeViewer}>
        <DialogContent
          className="fixed inset-0 z-[100] flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center gap-3 rounded-none border-0 bg-black/95 p-3 text-white shadow-none sm:rounded-none"
          aria-describedby={undefined}
        >
          <DialogTitle className="sr-only">{alt} — enlarged product photo</DialogTitle>
          <div className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
            <img
              src={src}
              alt={alt}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-150"
              style={{ transform: `scale(${scale})`, touchAction: 'pan-x pan-y' }}
            />
          </div>
          <div className="flex items-center justify-center gap-3 pb-[env(safe-area-inset-bottom)]">
            <Button type="button" size="icon" variant="secondary" onClick={zoomOut} disabled={scale <= 1} aria-label="Zoom out">
              <Minus className="h-5 w-5" />
            </Button>
            <span className="min-w-14 text-center text-sm tabular-nums">{Math.round(scale * 100)}%</span>
            <Button type="button" size="icon" variant="secondary" onClick={zoomIn} disabled={scale >= 4} aria-label="Zoom in">
              <Plus className="h-5 w-5" />
            </Button>
            <Button type="button" size="icon" variant="secondary" onClick={() => setScale(1)} disabled={scale === 1} aria-label="Reset zoom">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-white/70">Use + and − to inspect the product photo</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
