import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface SchoolLogoViewerProps {
  logoUrl: string;
  schoolName: string;
  trigger?: React.ReactNode;
}

export function SchoolLogoViewer({ logoUrl, schoolName, trigger }: SchoolLogoViewerProps) {
  const [zoom, setZoom] = useState(1);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.5, 0.5));
  };

  return (
    <Dialog onOpenChange={() => setZoom(1)}>
      <DialogTrigger asChild>
        {trigger || (
          <button className="w-16 h-16 rounded-full border-2 border-primary/20 overflow-hidden hover:border-primary transition-colors cursor-zoom-in">
            <img
              src={logoUrl}
              alt={`${schoolName} logo`}
              className="w-full h-full object-cover"
            />
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{schoolName} Logo</DialogTitle>
        </DialogHeader>
        
        <div className="flex justify-center gap-2 mb-4">
          <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= 0.5}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="flex items-center px-3 text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= 3}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center justify-center overflow-auto max-h-[60vh] bg-muted rounded-lg p-4">
          <img
            src={logoUrl}
            alt={`${schoolName} logo`}
            className="transition-transform duration-200"
            style={{ transform: `scale(${zoom})`, maxWidth: '100%', height: 'auto' }}
          />
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-2">
          Click + or - to zoom in/out
        </p>
      </DialogContent>
    </Dialog>
  );
}