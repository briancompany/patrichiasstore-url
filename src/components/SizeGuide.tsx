import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Ruler } from 'lucide-react';

const sizeData: Record<string, { sizes: string[]; measurements: Record<string, Record<string, string>> }> = {
  tshirt: {
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    measurements: {
      'Chest (cm)': { S: '86-91', M: '96-101', L: '106-111', XL: '116-121', XXL: '126-131' },
      'Length (cm)': { S: '66', M: '69', L: '72', XL: '75', XXL: '78' },
      'Shoulder (cm)': { S: '42', M: '44', L: '46', XL: '48', XXL: '50' },
    },
  },
  tracksuit: {
    sizes: ['S', 'M', 'L', 'XL'],
    measurements: {
      'Chest (cm)': { S: '92-97', M: '102-107', L: '112-117', XL: '122-127' },
      'Waist (cm)': { S: '72-77', M: '82-87', L: '92-97', XL: '102-107' },
      'Length - Top (cm)': { S: '64', M: '67', L: '70', XL: '73' },
      'Inseam (cm)': { S: '74', M: '76', L: '78', XL: '80' },
    },
  },
  shorts: {
    sizes: ['S', 'M', 'L', 'XL'],
    measurements: {
      'Waist (cm)': { S: '68-73', M: '78-83', L: '88-93', XL: '98-103' },
      'Length (cm)': { S: '38', M: '40', L: '42', XL: '44' },
    },
  },
  sweater: {
    sizes: ['S', 'M', 'L', 'XL'],
    measurements: {
      'Chest (cm)': { S: '90-95', M: '100-105', L: '110-115', XL: '120-125' },
      'Length (cm)': { S: '62', M: '65', L: '68', XL: '71' },
      'Sleeve (cm)': { S: '58', M: '60', L: '62', XL: '64' },
    },
  },
  skirt: {
    sizes: ['S', 'M', 'L', 'XL'],
    measurements: {
      'Waist (cm)': { S: '62-67', M: '72-77', L: '82-87', XL: '92-97' },
      'Length (cm)': { S: '45', M: '48', L: '50', XL: '52' },
    },
  },
  socks: {
    sizes: ['One Size'],
    measurements: {
      'Fits shoe size': { 'One Size': '36-45' },
    },
  },
};

const typeLabels: Record<string, string> = {
  tshirt: 'T-Shirt',
  tracksuit: 'Tracksuit',
  shorts: 'Shorts',
  sweater: 'Sweater',
  skirt: 'Skirt',
  socks: 'Socks',
};

interface SizeGuideProps {
  type?: string;
}

export function SizeGuide({ type }: SizeGuideProps) {
  const [selectedType, setSelectedType] = useState(type || 'tshirt');
  const data = sizeData[selectedType];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
          <Ruler className="h-3 w-3" />
          Size Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Size Guide</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 mb-4">
          {Object.keys(sizeData).map((t) => (
            <Button
              key={t}
              variant={selectedType === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedType(t)}
            >
              {typeLabels[t]}
            </Button>
          ))}
        </div>

        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-2 font-medium text-muted-foreground">Measurement</th>
                  {data.sizes.map((size) => (
                    <th key={size} className="text-center p-2 font-semibold">{size}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(data.measurements).map(([measurement, values]) => (
                  <tr key={measurement} className="border-b border-border/50">
                    <td className="p-2 text-muted-foreground">{measurement}</td>
                    {data.sizes.map((size) => (
                      <td key={size} className="text-center p-2 font-medium">{values[size] || '-'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs text-muted-foreground">
            <strong>How to measure:</strong> Use a soft tape measure. Chest — measure around the fullest part. 
            Waist — measure at natural waistline. Length — measure from shoulder to hem. 
            When between sizes, choose the larger size for comfort.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
