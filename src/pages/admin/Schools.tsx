import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Plus, Edit, Trash2, School, Upload, Loader2, Package, ChevronRight, Globe, Wand2, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { LogoCreator } from '@/components/admin/LogoCreator';

interface SchoolData {
  id: string;
  name: string;
  logo_url: string | null;
  productCount?: number;
}

interface UniformType {
  type: string;
  label: string;
}

const UNIFORM_TYPES: UniformType[] = [
  { type: 'tshirt', label: 'T-Shirt' },
  { type: 'tracksuit', label: 'Tracksuit' },
  { type: 'socks', label: 'Socks' },
  { type: 'shorts', label: 'Shorts' },
  { type: 'skirt', label: 'Skirt' },
  { type: 'sweater', label: 'Sweater' },
  { type: 'other', label: 'Other Uniform' },
];

export default function AdminSchools() {
  const location = useLocation();
  const navigate = useNavigate();
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uniformDialogOpen, setUniformDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [selectedSchoolForUniforms, setSelectedSchoolForUniforms] = useState<SchoolData | null>(null);
  const [formData, setFormData] = useState({ name: '', logo_url: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [selectedUniformTypes, setSelectedUniformTypes] = useState<string[]>([]);
  const [existingUniformTypes, setExistingUniformTypes] = useState<string[]>([]);
  const [uniformImages, setUniformImages] = useState<Record<string, File>>({});
  const [uniformImagePreviews, setUniformImagePreviews] = useState<Record<string, string>>({});
  const [showLogoCreator, setShowLogoCreator] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('schools');

  // Check for pre-filled data from order creation
  useEffect(() => {
    const state = location.state as { createSchool?: boolean; schoolName?: string; orderId?: string } | null;
    if (state?.createSchool && state?.schoolName) {
      setFormData({ name: state.schoolName, logo_url: '' });
      setPendingOrderId(state.orderId || null);
      setDialogOpen(true);
      // Clear the state
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .order('name');

    if (error) {
      toast.error('Error fetching schools');
    } else {
      const schoolsWithCounts = await Promise.all(
        (data || []).map(async (school) => {
          const { count } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', school.id);
          return { ...school, productCount: count || 0 };
        })
      );
      setSchools(schoolsWithCounts);
    }
    setIsLoading(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAILogoGenerated = (logoUrl: string) => {
    setFormData(prev => ({ ...prev, logo_url: logoUrl }));
    setLogoPreview(logoUrl);
    setShowLogoCreator(false);
    toast.success('AI-generated logo ready to use!');
  };

  const uploadLogo = async (): Promise<string | null> => {
    if (!logoFile) return formData.logo_url || null;

    const fileExt = logoFile.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('school-logos')
      .upload(fileName, logoFile);

    if (uploadError) {
      toast.error('Error uploading logo');
      return null;
    }

    const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let logoUrl = formData.logo_url;
      if (logoFile) {
        const uploadedUrl = await uploadLogo();
        if (uploadedUrl) {
          logoUrl = uploadedUrl;
        }
      }

      const schoolData = {
        name: formData.name,
        logo_url: logoUrl || null,
      };

      let newSchoolId: string | null = null;

      if (editingSchool) {
        const { error } = await supabase
          .from('schools')
          .update(schoolData)
          .eq('id', editingSchool.id);

        if (error) throw error;
        newSchoolId = editingSchool.id;
        toast.success('School updated');
      } else {
        const { data, error } = await supabase.from('schools').insert(schoolData).select().single();

        if (error) throw error;
        newSchoolId = data.id;
        toast.success('School added');
      }

      // If this was from an order, link the order to the new school
      if (pendingOrderId && newSchoolId) {
        await linkOrderToSchool(pendingOrderId, newSchoolId, logoUrl);
        setPendingOrderId(null);
      }

      await fetchSchools();
      resetForm();
    } catch (error) {
      console.error('Error saving school:', error);
      toast.error('Error saving school');
    } finally {
      setIsSaving(false);
    }
  };

  const linkOrderToSchool = async (orderId: string, schoolId: string, logoUrl: string | null) => {
    try {
      // Update the order to link to the school and change status
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          linked_school_id: schoolId,
          status: 'ready',
          is_new_school: false
        })
        .eq('id', orderId);

      if (orderError) throw orderError;

      // If logo exists, update order items that need printing
      if (logoUrl) {
        const { error: itemsError } = await supabase
          .from('order_items')
          .update({ logo_url: logoUrl })
          .eq('order_id', orderId)
          .eq('printing_required', true);

        if (itemsError) console.error('Error updating order items:', itemsError);
      }

      toast.success('Order linked and marked as Ready for Processing!');
    } catch (error) {
      console.error('Error linking order:', error);
      toast.error('Error linking order to school');
    }
  };

  const deleteSchool = async (id: string) => {
    const { error } = await supabase.from('schools').delete().eq('id', id);

    if (error) {
      toast.error('Error deleting school');
    } else {
      toast.success('School deleted');
      setSchools(schools.filter((s) => s.id !== id));
    }
  };

  const openEditDialog = (school: SchoolData) => {
    setEditingSchool(school);
    setFormData({ name: school.name, logo_url: school.logo_url || '' });
    setLogoPreview(school.logo_url);
    setDialogOpen(true);
  };

  const openUniformDialog = async (school: SchoolData) => {
    setSelectedSchoolForUniforms(school);
    
    const { data: products } = await supabase
      .from('products')
      .select('type')
      .eq('school_id', school.id);

    const existingTypes = [...new Set((products || []).map(p => p.type))];
    setExistingUniformTypes(existingTypes);
    setSelectedUniformTypes([]);
    setUniformImages({});
    setUniformImagePreviews({});
    setUniformDialogOpen(true);
  };

  const handleUniformImageChange = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUniformImages(prev => ({ ...prev, [type]: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setUniformImagePreviews(prev => ({ ...prev, [type]: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadUniformImage = async (type: string): Promise<string | null> => {
    const file = uniformImages[type];
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${type}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, file);

    if (uploadError) {
      console.error('Error uploading uniform image:', uploadError);
      return null;
    }

    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  const handleAddUniforms = async () => {
    if (!selectedSchoolForUniforms || selectedUniformTypes.length === 0) return;

    setIsSaving(true);
    try {
      const imageUrls: Record<string, string | null> = {};
      for (const type of selectedUniformTypes) {
        if (uniformImages[type]) {
          imageUrls[type] = await uploadUniformImage(type);
        }
      }

      const { data: pricingData } = await supabase
        .from('pricing_chart')
        .select('*');

      const pricingMap: Record<string, { size: string; price: number }[]> = {};
      (pricingData || []).forEach((p: { uniform_type: string; size: string; price: number }) => {
        if (!pricingMap[p.uniform_type]) pricingMap[p.uniform_type] = [];
        pricingMap[p.uniform_type].push({ size: p.size, price: p.price });
      });

      const defaultSizes = [
        { size: 'S', price: 1000 },
        { size: 'M', price: 1000 },
        { size: 'L', price: 1000 },
        { size: 'XL', price: 1000 },
      ];

      const typeNames: Record<string, string> = {
        tshirt: 'T-Shirt',
        tracksuit: 'Tracksuit',
        socks: 'Socks',
        shorts: 'Shorts',
        skirt: 'Skirt',
        sweater: 'Sweater',
        other: 'Uniform',
      };

      type UniformTypeEnum = 'tshirt' | 'tracksuit' | 'socks' | 'shorts' | 'skirt' | 'sweater' | 'other';

      const productsToInsert = selectedUniformTypes.map((type) => ({
        name: `${selectedSchoolForUniforms.name} ${typeNames[type] || 'Uniform'}`,
        type: type as UniformTypeEnum,
        school_id: selectedSchoolForUniforms.id,
        sizes: pricingMap[type] || defaultSizes,
        in_stock: true,
        description: `Official ${typeNames[type] || 'uniform'} for ${selectedSchoolForUniforms.name}`,
        image_url: imageUrls[type] || null,
      }));

      const { error } = await supabase.from('products').insert(productsToInsert);

      if (error) throw error;

      toast.success(`Added ${selectedUniformTypes.length} uniform types`);
      await fetchSchools();
      setUniformDialogOpen(false);
      setUniformImages({});
      setUniformImagePreviews({});
    } catch (error) {
      console.error('Error adding uniforms:', error);
      toast.error('Error adding uniforms');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setEditingSchool(null);
    setFormData({ name: '', logo_url: '' });
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(false);
    setShowLogoCreator(false);
    setPendingOrderId(null);
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Schools & Products</h1>
            <p className="text-muted-foreground">Manage schools, logos and general products</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add School
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingSchool ? 'Edit School' : pendingOrderId ? 'Create School Profile from Order' : 'Add New School'}
                </DialogTitle>
              </DialogHeader>
              
              {pendingOrderId && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span>Creating school from customer order. After saving, the order will be marked as Ready.</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">School Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Nairobi Primary School"
                    required
                  />
                </div>

                <div>
                  <Label>School Logo</Label>
                  <Tabs value={showLogoCreator ? 'ai' : 'upload'} onValueChange={(v) => setShowLogoCreator(v === 'ai')}>
                    <TabsList className="w-full mt-2">
                      <TabsTrigger value="upload" className="flex-1">
                        <Upload className="h-4 w-4 mr-1" />
                        Upload
                      </TabsTrigger>
                      <TabsTrigger value="ai" className="flex-1">
                        <Wand2 className="h-4 w-4 mr-1" />
                        AI Generate
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="mt-3">
                      <div className="flex gap-4 items-start">
                        {logoPreview && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                            <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="flex-1">
                          <Label htmlFor="logo" className="cursor-pointer">
                            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                              <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                              <p className="text-sm text-muted-foreground">Upload logo</p>
                            </div>
                          </Label>
                          <Input
                            id="logo"
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="ai" className="mt-3">
                      <LogoCreator 
                        schoolName={formData.name || 'School'} 
                        onLogoGenerated={handleAILogoGenerated}
                      />
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex gap-2 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSchool ? 'Update' : pendingOrderId ? 'Create & Link Order' : 'Add School'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Tabs for Schools and General Products */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="schools">
              <School className="h-4 w-4 mr-2" />
              Schools ({schools.length})
            </TabsTrigger>
            <TabsTrigger value="general">
              <Package className="h-4 w-4 mr-2" />
              General Products
            </TabsTrigger>
          </TabsList>

          <TabsContent value="schools" className="mt-6">
            {/* Add Uniforms Dialog */}
            <Dialog open={uniformDialogOpen} onOpenChange={setUniformDialogOpen}>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Uniforms for {selectedSchoolForUniforms?.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select uniform types and optionally upload images. Prices from your pricing chart.
                  </p>
                  <div className="space-y-4">
                    {UNIFORM_TYPES.map((uniform) => {
                      const isExisting = existingUniformTypes.includes(uniform.type);
                      const isSelected = selectedUniformTypes.includes(uniform.type);
                      return (
                        <div key={uniform.type} className={`p-3 rounded-lg border ${isSelected ? 'border-primary bg-primary/5' : 'border-border'}`}>
                          <div className="flex items-center gap-3">
                            <Checkbox
                              id={uniform.type}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedUniformTypes([...selectedUniformTypes, uniform.type]);
                                } else {
                                  setSelectedUniformTypes(selectedUniformTypes.filter(t => t !== uniform.type));
                                  const newImages = { ...uniformImages };
                                  delete newImages[uniform.type];
                                  setUniformImages(newImages);
                                  const newPreviews = { ...uniformImagePreviews };
                                  delete newPreviews[uniform.type];
                                  setUniformImagePreviews(newPreviews);
                                }
                              }}
                              disabled={isExisting}
                            />
                            <Label htmlFor={uniform.type} className={`flex-1 ${isExisting ? 'text-muted-foreground' : ''}`}>
                              {uniform.label}
                              {isExisting && (
                                <Badge variant="secondary" className="ml-2">Already added</Badge>
                              )}
                            </Label>
                          </div>
                          
                          {isSelected && !isExisting && (
                            <div className="mt-3 ml-7">
                              <div className="flex items-center gap-3">
                                {uniformImagePreviews[uniform.type] ? (
                                  <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                                    <img src={uniformImagePreviews[uniform.type]} alt={uniform.label} className="w-full h-full object-cover" />
                                  </div>
                                ) : null}
                                <div className="flex-1">
                                  <Label htmlFor={`img-${uniform.type}`} className="cursor-pointer">
                                    <div className="border-2 border-dashed border-border rounded-lg p-2 text-center hover:border-primary/50 transition-colors text-xs">
                                      <Upload className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
                                      {uniformImagePreviews[uniform.type] ? 'Change image' : 'Upload image (optional)'}
                                    </div>
                                  </Label>
                                  <Input
                                    id={`img-${uniform.type}`}
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => handleUniformImageChange(uniform.type, e)}
                                    className="hidden"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 justify-end pt-4">
                    <Button variant="outline" onClick={() => setUniformDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddUniforms} 
                      disabled={isSaving || selectedUniformTypes.length === 0}
                    >
                      {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add {selectedUniformTypes.length} Uniform{selectedUniformTypes.length !== 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {schools.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <School className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No schools yet</h3>
                  <p className="text-muted-foreground mb-4">Add schools to organize your products</p>
                  <Button onClick={() => setDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add School
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {schools.map((school) => (
                  <Card key={school.id} className="group hover:shadow-lg transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                          {school.logo_url ? (
                            <img
                              src={school.logo_url}
                              alt={school.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <School className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{school.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              <Package className="h-3 w-3 mr-1" />
                              {school.productCount} uniforms
                            </Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => openUniformDialog(school)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Uniforms
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(school)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete School</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{school.name}"? Products linked to
                                this school will be unlinked.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSchool(school.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="general" className="mt-6">
            <GeneralProductsSection />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// General Products Section Component
function GeneralProductsSection() {
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'tshirt',
    description: '',
    image_url: ''
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchGeneralProducts();
  }, []);

  const fetchGeneralProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .is('school_id', null)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Error fetching products');
    } else {
      setProducts(data || []);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let imageUrl = formData.image_url;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `general-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }

      // Fetch pricing
      const { data: pricingData } = await supabase
        .from('pricing_chart')
        .select('*')
        .eq('uniform_type', formData.type);

      const sizes = pricingData && pricingData.length > 0
        ? pricingData.map(p => ({ size: p.size, price: p.price }))
        : [
            { size: 'S', price: 1000 },
            { size: 'M', price: 1000 },
            { size: 'L', price: 1000 },
            { size: 'XL', price: 1000 },
          ];

      const productData = {
        name: formData.name,
        type: formData.type as any,
        description: formData.description,
        image_url: imageUrl || null,
        school_id: null,
        sizes,
        in_stock: true,
      };

      const { error } = await supabase.from('products').insert(productData);

      if (error) throw error;

      toast.success('Product added successfully');
      await fetchGeneralProducts();
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error saving product');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      toast.error('Error deleting product');
    } else {
      toast.success('Product deleted');
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const resetForm = () => {
    setFormData({ name: '', type: 'tshirt', description: '', image_url: '' });
    setImageFile(null);
    setImagePreview(null);
    setDialogOpen(false);
  };

  const typeLabels: Record<string, string> = {
    tshirt: 'T-Shirt',
    tracksuit: 'Tracksuit',
    socks: 'Socks',
    shorts: 'Shorts',
    skirt: 'Skirt',
    sweater: 'Sweater',
    other: 'Other',
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">General Products</h3>
          <p className="text-sm text-muted-foreground">Products available to all customers regardless of school</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add General Product</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="product-name">Product Name *</Label>
                <Input
                  id="product-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Plain White T-Shirt"
                  required
                />
              </div>

              <div>
                <Label htmlFor="product-type">Type *</Label>
                <select
                  id="product-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2 border rounded-md"
                >
                  {Object.entries(typeLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="product-desc">Description</Label>
                <Input
                  id="product-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div>
                <Label>Product Image</Label>
                <div className="flex gap-4 items-start mt-2">
                  {imagePreview && (
                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex-1">
                    <Label htmlFor="product-image" className="cursor-pointer">
                      <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors">
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                        <p className="text-sm text-muted-foreground">Upload image</p>
                      </div>
                    </Label>
                    <Input
                      id="product-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Product
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No general products yet</h3>
            <p className="text-muted-foreground mb-4">Add products that are available to all customers</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                <div className="aspect-video bg-muted rounded-lg overflow-hidden mb-3">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold">{product.name}</h4>
                  <Badge variant="secondary">{typeLabels[product.type]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  {product.sizes?.length || 0} sizes available
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-destructive w-full">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Product</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{product.name}"?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteProduct(product.id)}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
