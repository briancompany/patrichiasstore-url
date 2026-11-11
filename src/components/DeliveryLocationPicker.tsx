import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { MapPin, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface DeliveryLocationPickerProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export function DeliveryLocationPicker({ value, onChange, id = 'deliveryLocation' }: DeliveryLocationPickerProps) {
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Location access is not supported by this browser');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lat = coords.latitude.toFixed(6);
        const lng = coords.longitude.toFixed(6);
        onChange(`https://www.google.com/maps?q=${lat},${lng} (GPS: ${lat}, ${lng})`);
        setLocating(false);
        toast.success('Your map location has been added');
      },
      () => {
        setLocating(false);
        toast.error('Could not get your location. Allow location access or paste a Google Maps link.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Delivery Location *</Label>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter your area/address, or paste a Google Maps location link. A landmark is optional."
        required
        rows={3}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useCurrentLocation} disabled={locating}>
          {locating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MapPin className="h-4 w-4 mr-1" />}
          Use my current location
        </Button>
        <Button type="button" variant="outline" size="sm" asChild>
          <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4 mr-1" /> Open Google Maps
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You can use your GPS location or paste a Google Maps pin/share link. You do not need to provide a landmark.
      </p>
    </div>
  );
}
