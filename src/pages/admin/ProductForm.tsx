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
  stock: number;
}

interface School {
  id: string;
  name: string;
}

const uniformTypes = [
  { value: 'tshirt', label: 'T-Shirt' },
  { value: 'shirts', label: 'Shirts' },
  { value: 'tracksuit', label: 'Tracksuit' },
  { value: 'socks', label: 'Socks' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'trousers', label: 'Trousers' },
  { value: 'skirt', label: 'Skirt' },
  { value: 'sweater', label: 'Sweater' },
  { value: 'tie', label: 'Tie' },
  { value: 'dress', label: 'Dress' },
  { value: 'fleece_jacket', label: 'Fleece Jacket' },
  { value: 'other', label: 'Other' },
];

const defaultSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    school_id: '',
    type: 'tshirt',
    description: '',
    image_url: '',
    in_stock: true,
    sizes: [{ size: 'M', price: 500, stock: 10 }] as SizePrice[],
  });

  useEffect(() => {
    fetchSchools();
    if (isEditing) {
      fetchProduct();
    }
  }, [id]);

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
      image_url: data.image_url || '',
      in_stock: data.in_stock,
      sizes: sizesData,
    });

    if (data.image_url) {
      setImagePreview(data.image_url);
    }

    setIsLoading(false);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const productData = {
        name: formData.name,
        school_id: formData.school_id || null,
        type: formData.type as 'tshirt' | 'tracksuit' | 'socks' | 'shorts' | 'skirt' | 'sweater' | 'tie' | 'dress' | 'fleece_jacket' | 'other',
        description: formData.description || null,
        image_url: imageUrl || null,
        in_stock: formData.in_stock,
        sizes: JSON.parse(JSON.stringify(formData.sizes)),
      };

      if (isEditing) {
        const { error } = await supabase.from('products').update(productData).eq('id', id);

        if (error) throw error;
        toast.success('Product updated successfully');
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

  const updateSize = (index: number, field: keyof SizePrice, value: string | number) => {
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
              <CardTitle>Sizes & Pricing</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addSize}>
                <Plus className="h-4 w-4 mr-1" />
                Add Size
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {formData.sizes.map((size, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <div className="flex-1">
                      <Label>Size</Label>
                      <Input
                        value={size.size}
                        onChange={(e) => updateSize(index, 'size', e.target.value)}
                        placeholder="e.g., M"
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Price (Ksh)</Label>
                      <Input
                        type="number"
                        value={size.price}
                        onChange={(e) => updateSize(index, 'price', parseInt(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                    <div className="flex-1">
                      <Label>Stock</Label>
                      <Input
                        type="number"
                        value={size.stock}
                        onChange={(e) => updateSize(index, 'stock', parseInt(e.target.value) || 0)}
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
