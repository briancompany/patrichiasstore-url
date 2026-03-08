import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPin, Truck } from 'lucide-react';

interface DeliveryZone {
  id: string;
  zone_name: string;
  delivery_fee: number;
  estimated_days: number;
}

interface DeliveryCostCalculatorProps {
  onZoneSelect: (zone: DeliveryZone | null) => void;
  selectedZoneId?: string;
}

export function DeliveryCostCalculator({ onZoneSelect, selectedZoneId }: DeliveryCostCalculatorProps) {
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [selected, setSelected] = useState<string>(selectedZoneId || '');

  useEffect(() => {
    const fetchZones = async () => {
      const { data } = await supabase
        .from('delivery_zones')
        .select('id, zone_name, delivery_fee, estimated_days')
        .eq('is_active', true)
        .order('delivery_fee', { ascending: true });
      setZones(data || []);
    };
    fetchZones();
  }, []);

  const handleChange = (zoneId: string) => {
    setSelected(zoneId);
    const zone = zones.find((z) => z.id === zoneId) || null;
    onZoneSelect(zone);
  };

  const selectedZone = zones.find((z) => z.id === selected);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        Select Delivery Zone
      </div>
      <Select value={selected} onValueChange={handleChange}>
        <SelectTrigger>
          <SelectValue placeholder="Choose your area..." />
        </SelectTrigger>
        <SelectContent>
          {zones.map((zone) => (
            <SelectItem key={zone.id} value={zone.id}>
              <div className="flex items-center justify-between gap-4 w-full">
                <span>{zone.zone_name}</span>
                <span className="text-muted-foreground text-xs">
                  Ksh {zone.delivery_fee.toLocaleString()}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedZone && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg text-sm">
          <Truck className="h-4 w-4 text-primary" />
          <div>
            <p className="font-medium">Ksh {selectedZone.delivery_fee.toLocaleString()} delivery fee</p>
            <p className="text-xs text-muted-foreground">
              Estimated {selectedZone.estimated_days} day{selectedZone.estimated_days > 1 ? 's' : ''} delivery
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
