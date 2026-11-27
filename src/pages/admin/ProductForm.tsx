import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Plus, Trash2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

interface SizePrice {
  size: string;
  price: number;
  stock?: number;
}

interface School {
  id: string;
  name: string;
}

const defaultSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const categoryKey = (value: string) => {
  const key = value.trim().toLowerCase().replace(/[–—-]/g, ' ').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const aliases: Record<string, string> = {
    dresses: 'dress', dress: 'dress',
    tracksuits: 'tracksuit', track_suit: 'tracksuit',
    jumpers: 'fleece_jacket', jumper: 'fleece_jacket', fleeze: 'fleece_jacket',
    lab_coat: 'lab_coats', labcoat: 'lab_coats',
    blazer: 'blazers',
  };
  if (aliases[key]) return aliases[key];
  return key.endsWith('s') && !['shorts', 'trousers', 'scrubs'].includes(key) ? key.slice(0, -1) : key;
};

const findChartForType = (charts: Record<string, { size: string; price: number }[]>, type: string) => {
  if (charts[type]?.length) return charts[type];
  const target = categoryKey(type);
  const match = Object.keys(charts).find((key) => categoryKey(key) === target && charts[key]?.length);
  return match ? charts[match] : undefined;
};

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [uniformTypes, setUniformTypes] = useState<{ value: string; label: string }[]>([]);
  const [pricingByType, setPricingByType] = useState<Record<string, { size: string; price: number }[]>>({});
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    school_id: '',
    type: 'tshirt',
    description: '',
    colors: [] as string[],
    image_url: '',
    in_stock: true,
    stock_quantity: 0,
    sizes: [{ size: 'M', price: 500, stock: 10 }] as SizePrice[],
  });

  useEffect(() => {
    fetchSchools();
    fetchPricingChart();
    fetchUniformTypes();
    if (isEditing) {
      fetchProduct();
    }
  }, [id]);

  const fetchUniformTypes = async () => { const { data } = await supabase.from('product_types').select('slug, name').eq('is_active', true).order('sort_order').order('name'); setUniformTypes((data || []).map(item => ({ value: item.slug, label: item.name }))); };

  const fetchPricingChart = async () => {
    const { data, error } = await supabase.from('pricing_chart').select('uniform_type, size, price').order('uniform_type').order('size');
    if (error) { console.error('Could not load shared price charts:', error); return; }
    const grouped: Record<string, { size: string; price: number }[]> = {};
    (data || []).forEach((entry) => {
      (grouped[entry.uniform_type] ||= []).push({ size: entry.size, price: Number(entry.price) });
    });
    setPricingByType(grouped);
  };

  const fetchSchools = async () => {
    const { data } = await supabase.from('schools').select('id, name').order('name');
    setSchools(data || []);
  };

  const fetchProduct = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('products').select('*').eq('id', id).single();

    if (error || !data) {
      toast.error('Product not found');
      navigate('/admin/products');
      return;
    }

    const sizesData = (data.sizes as unknown as SizePrice[]) || [];

    setFormData({
      name: data.name,
      school_id: data.school_id || '',
      type: data.type,
      description: data.description || '',
      colors: Array.isArray(data.colors) ? data.colors : [],
      image_url: data.image_url || '',
      in_stock: data.in_stock,
      stock_quantity: Number(data.stock_quantity ?? 0),
      sizes: sizesData,
    });

    if (data.image_url) {
      setImagePreview(data.image_url);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    const chart = findChartForType(pricingByType, formData.type);
    if (!chart?.length || isLoading) return;
    setFormData((current) => ({
      ...current,
      sizes: chart.map((entry) => ({
        ...entry,
        stock: current.sizes.find((size) => size.size === entry.size)?.stock,
      })),
    }));
  }, [formData.type, pricingByType, isLoading]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return formData.image_url || null;

    const fileExt = imageFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageFile);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      toast.error('Error uploading image');
      return null;
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const chartManagedTypes = new Set([
    'shirts_york', 'shirts_normal_plain', 't_shirts_kids', 't_shirts_adults', 'polo_shirts',
    'long_sleeve_shirts_plain', 'long_sleeve_shirts_stripes', 'shorts_summit', 'shorts_grey',
    'tracksuit', 'fleece_jacket', 'blazers', 'trousers_primary_school_summit',
    'trousers_primary_school_grey', 'trousers_high_school_summit', 'trousers_high_school_grey',
    'socks', 'lab_coats', 'scrubs',
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (chartManagedTypes.has(formData.type) && !findChartForType(pricingByType, formData.type)?.length) {
      toast.error('This uniform category has no imported size/price chart. Import its CSV chart before saving the product.');
      return;
    }
    setIsSaving(true);

    try {
      // Upload image if new file selected
      let imageUrl = formData.image_url;
      if (imageFile) {
        const uploadedUrl = await uploadImage();
        if (uploadedUrl) {
          imageUrl = uploadedUrl;
        }
      }

      const activeChart = findChartForType(pricingByType, formData.type);
      const savedSizes = activeChart?.length
        ? activeChart.map((entry) => ({
            ...entry,
            stock: formData.sizes.find((size) => size.size === entry.size)?.stock,
          }))
        : formData.sizes;
      const hasCompleteSizeStock = Boolean(activeChart?.length) && savedSizes.length > 0 && savedSizes.every(
        (size) => Number.isSafeInteger(size.stock) && Number(size.stock) >= 0,
      );
      const totalSizeStock = hasCompleteSizeStock
        ? savedSizes.reduce((total, size) => total + Number(size.stock), 0)
        : null;

      const productData = {
        name: formData.name,
        school_id: formData.school_id || null,
        type: formData.type as import('@/integrations/supabase/types').Database['public']['Enums']['uniform_type'],
        description: formData.description || null,
        colors: [...new Set(formData.colors.map((color) => color.trim().toLowerCase()).filter(Boolean))],
        image_url: imageUrl || null,
        in_stock: formData.in_stock && (totalSizeStock === null || totalSizeStock > 0),
        stock_quantity: totalSizeStock ?? Math.max(0, Number(formData.stock_quantity) || 0),
        sizes: JSON.parse(JSON.stringify(savedSizes)),
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(productData).eq('id', id);

        if (error) throw error;
        let restockEmailError = false;
        if (productData.in_stock && productData.stock_quantity > 0) {
          const { error: notifyError } = await supabase.functions.invoke('notify-back-in-stock', {
            body: { productId: id },
          });
          if (notifyError) {
            restockEmailError = true;
            console.error('Back-in-stock notification failed:', notifyError);
          }
        }
        toast.success('Product updated successfully');
        if (restockEmailError) {
          toast.error('Product saved, but restock emails could not be sent. Please retry from the stock controls.');
        }
      } else {
        const { error } = await supabase.from('products').insert(productData);

        if (error) throw error;
        toast.success('Product created successfully');
      }

      navigate('/admin/products');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error saving product');
    } finally {
      setIsSaving(false);
    }
  };

  const addSize = () => {
    const usedSizes = formData.sizes.map((s) => s.size);
    const nextSize = defaultSizes.find((s) => !usedSizes.includes(s)) || 'Custom';
    setFormData({
      ...formData,
      sizes: [...formData.sizes, { size: nextSize, price: 500, stock: 10 }],
    });
  };

  const removeSize = (index: number) => {
    setFormData({
      ...formData,
      sizes: formData.sizes.filter((_, i) => i !== index),
    });
  };

  const updateSize = (index: number, field: keyof SizePrice, value: string | number | undefined) => {
    const newSizes = [...formData.sizes];
    newSizes[index] = { ...newSizes[index], [field]: value };
    setFormData({ ...formData, sizes: newSizes });
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/products')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isEditing ? 'Edit Product' : 'New Product'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update product details' : 'Add a new uniform to your inventory'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Product Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., School T-Shirt"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Uniform Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {uniformTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                      {Object.keys(pricingByType).filter((value) => !uniformTypes.some((type) => type.value === value)).map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="school">School</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) => setFormData({ ...formData, school_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="colors">Colours (separate multiple colours with commas)</Label>
                <Input id="colors" value={formData.colors.join(', ')} onChange={(e) => setFormData({ ...formData, colors: e.target.value.split(',').map((color) => color.trim()).filter(Boolean) })} placeholder="e.g. grey, white" />
                <p className="text-xs text-muted-foreground mt-1">Add every colour present. For patterns such as white stripes, keep the details in the description too.</p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Product description..."
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  id="in_stock"
                  checked={formData.in_stock}
                  onCheckedChange={(checked) => setFormData({ ...formData, in_stock: checked })}
                />
                <Label htmlFor="in_stock">In Stock</Label>
              </div>

              <div>
                <Label htmlFor="stock_quantity">Stock quantity (pieces available)</Label>
                <Input
                  id="stock_quantity"
                  inputMode="numeric"
                  value={String(formData.stock_quantity)}
                  disabled={Boolean(pricingByType[formData.type]?.length && formData.sizes.length > 0 && formData.sizes.every((size) => Number.isSafeInteger(size.stock) && Number(size.stock) >= 0))}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      stock_quantity: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0,
                    })
                  }
                  placeholder="e.g. 299"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  When every size has a stock quantity, the total is calculated from those sizes. Otherwise this total remains the fallback inventory for older or partially configured products.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Image */}
          <Card>
            <CardHeader>
              <CardTitle>Product Image</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                {imagePreview && (
                  <div className="w-32 h-32 rounded-lg overflow-hidden bg-muted">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1">
                  <Label htmlFor="image" className="cursor-pointer">
                    <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Click to upload or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 5MB</p>
                    </div>
                  </Label>
                  <Input
                    id="image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sizes & Pricing */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Sizes, Prices & Stock</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addSize}>
                <Plus className="h-4 w-4 mr-1" />
                Add Size
              </Button>
            </CardHeader>
            <CardContent>
              {findChartForType(pricingByType, formData.type)?.length ? (
                <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  This product uses the shared {uniformTypes.find((type) => type.value === formData.type)?.label || formData.type} price chart. Size labels and prices update from Admin → Size & Price Charts. Stock remains specific to this product.
                </p>
              ) : (
                <p className="mb-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                  No shared chart exists for this category yet. Add its sizes and prices in Admin → Size & Price Charts; this product will use those prices automatically. Until then, you can enter sizes and prices below.
                </p>
              )}
              <div className="space-y-4">
                {formData.sizes.map((size, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <Label>Size</Label>
                      <Input
                        value={size.size}
                        onChange={(e) => updateSize(index, 'size', e.target.value)}
                        disabled={Boolean(findChartForType(pricingByType, formData.type)?.length)}
                        placeholder="e.g., M"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Price (Ksh)</Label>
                      <Input
                        type="number"
                        value={size.price}
                        onChange={(e) => updateSize(index, 'price', parseInt(e.target.value) || 0)}
                        disabled={Boolean(findChartForType(pricingByType, formData.type)?.length)}
                        min={0}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Stock</Label>
                      <Input
                        type="number"
                        value={size.stock ?? ''}
                        onChange={(e) => updateSize(index, 'stock', e.target.value === '' ? undefined : parseInt(e.target.value, 10))}
                        min={0}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSize(index)}
                      className="mt-6 text-destructive"
                      disabled={formData.sizes.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/products')}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Update Product' : 'Create Product'}
            </Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
