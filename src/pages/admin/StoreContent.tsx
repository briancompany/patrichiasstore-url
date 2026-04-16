import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Save, Upload, Trash2, Image, UserCircle, FileImage, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminStoreContent() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contentId, setContentId] = useState<string | null>(null);
  const [ownerPhotoUrl, setOwnerPhotoUrl] = useState<string | null>(null);
  const [priceChartUrl, setPriceChartUrl] = useState<string | null>(null);
  const [shopDescription, setShopDescription] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingChart, setUploadingChart] = useState(false);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    const { data, error } = await supabase
      .from('store_content')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (error) {
      toast.error('Error loading store content');
      console.error(error);
    } else if (data) {
      setContentId(data.id);
      setOwnerPhotoUrl(data.owner_photo_url);
      setPriceChartUrl(data.price_chart_url);
      setShopDescription(data.shop_description || '');
    }
    setLoading(false);
  };

  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const fileName = `${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from('store-content')
      .upload(fileName, file, { upsert: true });

    if (error) {
      toast.error('Upload failed');
      console.error(error);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('store-content')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const deleteImage = async (url: string) => {
    try {
      // Extract path from URL
      const parts = url.split('/store-content/');
      if (parts[1]) {
        await supabase.storage.from('store-content').remove([parts[1]]);
      }
    } catch (e) {
      console.error('Error deleting image:', e);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);

    // Delete old photo if exists
    if (ownerPhotoUrl) await deleteImage(ownerPhotoUrl);

    const url = await uploadImage(file, 'owner-photo');
    if (url) {
      setOwnerPhotoUrl(url);
      toast.success('Photo uploaded');
    }
    setUploadingPhoto(false);
    e.target.value = '';
  };

  const handleDeletePhoto = async () => {
    if (ownerPhotoUrl) {
      await deleteImage(ownerPhotoUrl);
      setOwnerPhotoUrl(null);
      toast.success('Photo removed');
    }
  };

  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingChart(true);

    if (priceChartUrl) await deleteImage(priceChartUrl);

    const url = await uploadImage(file, 'price-chart');
    if (url) {
      setPriceChartUrl(url);
      toast.success('Price chart uploaded');
    }
    setUploadingChart(false);
    e.target.value = '';
  };

  const handleDeleteChart = async () => {
    if (priceChartUrl) {
      await deleteImage(priceChartUrl);
      setPriceChartUrl(null);
      toast.success('Chart removed');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      owner_photo_url: ownerPhotoUrl,
      price_chart_url: priceChartUrl,
      shop_description: shopDescription,
    };

    let error;
    if (contentId) {
      ({ error } = await supabase
        .from('store_content')
        .update(payload)
        .eq('id', contentId));
    } else {
      const { data, error: insertError } = await supabase
        .from('store_content')
        .insert(payload)
        .select()
        .single();
      error = insertError;
      if (data) setContentId(data.id);
    }

    if (error) {
      toast.error('Error saving');
      console.error(error);
    } else {
      toast.success('Store content saved');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Store Content</h1>
          <p className="text-muted-foreground">Manage your profile photo, price chart, and shop description</p>
        </div>

        {/* Owner Profile Photo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Owner Profile Photo
            </CardTitle>
            <CardDescription>Your photo displayed on the store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownerPhotoUrl ? (
              <div className="flex items-start gap-4">
                <img
                  src={ownerPhotoUrl}
                  alt="Owner"
                  className="w-32 h-32 rounded-full object-cover border-2 border-border"
                />
                <div className="flex flex-col gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <Button variant="outline" size="sm" asChild disabled={uploadingPhoto}>
                      <span>
                        {uploadingPhoto ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Replace Photo
                      </span>
                    </Button>
                  </label>
                  <Button variant="destructive" size="sm" onClick={handleDeletePhoto}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Photo
                  </Button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  {uploadingPhoto ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  ) : (
                    <>
                      <UserCircle className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload your photo</p>
                    </>
                  )}
                </div>
              </label>
            )}
          </CardContent>
        </Card>

        {/* Price Chart Image */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Price Chart Image
            </CardTitle>
            <CardDescription>Upload your price chart — it will be fully visible and downloadable by customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {priceChartUrl ? (
              <div className="space-y-4">
                <div className="rounded-lg overflow-hidden border border-border">
                  <img
                    src={priceChartUrl}
                    alt="Price Chart"
                    className="w-full h-auto"
                  />
                </div>
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handleChartUpload} />
                    <Button variant="outline" size="sm" asChild disabled={uploadingChart}>
                      <span>
                        {uploadingChart ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                        Replace Chart
                      </span>
                    </Button>
                  </label>
                  <Button variant="destructive" size="sm" onClick={handleDeleteChart}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Chart
                  </Button>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleChartUpload} />
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                  {uploadingChart ? (
                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  ) : (
                    <>
                      <Image className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Click to upload price chart image</p>
                    </>
                  )}
                </div>
              </label>
            )}
          </CardContent>
        </Card>

        {/* Shop Description */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileImage className="h-5 w-5" />
              Shop Description
            </CardTitle>
            <CardDescription>This text is displayed above products on the Shop page</CardDescription>
          </CardHeader>
          <CardContent>
            <Label>Description Text</Label>
            <Textarea
              value={shopDescription}
              onChange={(e) => setShopDescription(e.target.value)}
              rows={14}
              className="mt-2 font-mono text-sm"
              placeholder="Enter the description shown to customers..."
            />
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save All Changes'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
