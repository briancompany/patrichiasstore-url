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
      toast.error('Your browser does not support GPS location. Enter your address or paste a Google Maps pin instead.');
      return;
    }

    if (!window.isSecureContext) {
      toast.error('GPS requires a secure HTTPS connection. Open the store website using its HTTPS address.');
      return;
    }

    setLocating(true);

    const saveLocation = (position: GeolocationPosition) => {
      const lat = position.coords.latitude.toFixed(6);
      const lng = position.coords.longitude.toFixed(6);
      onChange(`https://www.google.com/maps?q=${lat},${lng} (GPS: ${lat}, ${lng})`);
      setLocating(false);
      toast.success('Your map location has been added');
    };

    const showLocationError = (error: GeolocationPositionError) => {
      setLocating(false);
      switch (error.code) {
        case error.PERMISSION_DENIED:
          toast.error('Location permission is blocked. In your browser site settings, allow Location for patrichiasstore-url.vercel.app, then try again.');
          break;
        case error.POSITION_UNAVAILABLE:
          toast.error('Your device could not determine its location. Turn on Location/GPS, check your signal, or paste a Google Maps pin.');
          break;
        case error.TIMEOUT:
          toast.error('Getting your location took too long. Check that Location/GPS is on and try again, or paste a Google Maps pin.');
          break;
        default:
          toast.error('Location could not be retrieved. Check browser location permission and your device Location setting, or paste a Google Maps pin.');
      }
    };

    // Try precise GPS first. If the device cannot obtain a precise fix, retry
    // using the faster network-assisted location available on many phones.
    navigator.geolocation.getCurrentPosition(
      saveLocation,
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          showLocationError(error);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          saveLocation,
          showLocationError,
          { enableHighAccuracy: false, timeout: 20000, maximumAge: 120000 },
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
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
          {locating ? 'Getting location…' : 'Use my current location'}
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
