import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Save, Tag } from 'lucide-react';
import { toast } from 'sonner';

interface PriceEntry {
  id: string;
  uniform_type: string;
  size: string;
  price: number;
}

const uniformTypes = [
  { value: 'tshirt', label: 'T-Shirt' },
  { value: 'tracksuit', label: 'Tracksuit' },
  { value: 'socks', label: 'Socks' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'sweater', label: 'Sweater' },
  { value: 'tie', label: 'Tie' },
  { value: 'dress', label: 'Dress' },
  { value: 'fleece_jacket', label: 'Fleece Jacket' },
  { value: 'other', label: 'Other' },
];

const standardSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

export default function PricingChart() {
  const [prices, setPrices] = useState<PriceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newEntry, setNewEntry] = useState({
    uniform_type: '',
    size: '',
    price: '',
  });

  useEffect(() => {
    fetchPrices();
  }, []);

  const fetchPrices = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('pricing_chart')
      .select('*')
      .order('uniform_type')
      .order('size');

    if (error) {
      toast.error('Error fetching prices');
    } else {
      setPrices(data || []);
    }
    setIsLoading(false);
  };

  const handleAddPrice = async () => {
    if (!newEntry.uniform_type || !newEntry.size || !newEntry.price) {
      toast.error('Please fill all fields');
      return;
    }

    const priceValue = parseInt(newEntry.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast.error('Please enter a valid price');
      return;
    }

    const { error } = await supabase.from('pricing_chart').upsert(
      {
        uniform_type: newEntry.uniform_type,
        size: newEntry.size,
        price: priceValue,
      },
      {
        onConflict: 'uniform_type,size',
      }
    );

    if (error) {
      if (error.code === '23505') {
        toast.error('This price entry already exists');
      } else {
        toast.error('Error adding price');
      }
    } else {
      toast.success('Price added successfully');
      setNewEntry({ uniform_type: '', size: '', price: '' });
      fetchPrices();
    }
  };

  const handleDeletePrice = async (id: string) => {
    const { error } = await supabase.from('pricing_chart').delete().eq('id', id);

    if (error) {
      toast.error('Error deleting price');
    } else {
      toast.success('Price deleted');
      setPrices(prices.filter((p) => p.id !== id));
    }
  };

  const handleUpdatePrice = async (id: string, newPrice: number) => {
    const { error } = await supabase
      .from('pricing_chart')
      .update({ price: newPrice })
      .eq('id', id);

    if (error) {
      toast.error('Error updating price');
    } else {
      toast.success('Price updated');
      setPrices(prices.map((p) => (p.id === id ? { ...p, price: newPrice } : p)));
    }
  };

  const getTypeLabel = (type: string) => {
    return uniformTypes.find((t) => t.value === type)?.label || type;
  };

  const groupedPrices = prices.reduce((acc, price) => {
    if (!acc[price.uniform_type]) {
      acc[price.uniform_type] = [];
    }
    acc[price.uniform_type].push(price);
    return acc;
  }, {} as Record<string, PriceEntry[]>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pricing Chart</h1>
            <p className="text-muted-foreground">
              Set standard prices for all uniform types and sizes. These prices will be used for online school orders.
            </p>
          </div>
        </div>

        {/* Add New Price */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Price Entry
            </CardTitle>
            <CardDescription>
              Add or update a price for a specific uniform type and size
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Uniform Type</Label>
                <Select
                  value={newEntry.uniform_type}
                  onValueChange={(v) => setNewEntry({ ...newEntry, uniform_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniformTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Size</Label>
                <Select
                  value={newEntry.size}
                  onValueChange={(v) => setNewEntry({ ...newEntry, size: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    {standardSizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price (Ksh)</Label>
                <Input
                  type="number"
                  placeholder="e.g., 800"
                  value={newEntry.price}
                  onChange={(e) => setNewEntry({ ...newEntry, price: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleAddPrice} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Price
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Price Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : prices.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Tag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No prices configured yet</h3>
              <p className="text-muted-foreground">
                Add your first price entry above to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {Object.entries(groupedPrices).map(([type, typeprices]) => (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="text-lg">{getTypeLabel(type)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Size</TableHead>
                        <TableHead>Price (Ksh)</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {typeprices.map((price) => (
                        <TableRow key={price.id}>
                          <TableCell className="font-medium">{price.size}</TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              defaultValue={price.price}
                              className="w-32"
                              onBlur={(e) => {
                                const newPrice = parseInt(e.target.value);
                                if (newPrice !== price.price && newPrice > 0) {
                                  handleUpdatePrice(price.id, newPrice);
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Price Entry</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this price? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePrice(price.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
