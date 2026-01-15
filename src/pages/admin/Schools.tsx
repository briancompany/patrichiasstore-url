import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
import { Plus, Edit, Trash2, School, Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SchoolData {
  id: string;
  name: string;
  logo_url: string | null;
}

export default function AdminSchools() {
  const [schools, setSchools] = useState<SchoolData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolData | null>(null);
  const [formData, setFormData] = useState({ name: '', logo_url: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    const { data, error } = await supabase.from('schools').select('*').order('name');

    if (error) {
      toast.error('Error fetching schools');
    } else {
      setSchools(data || []);
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

      if (editingSchool) {
        const { error } = await supabase
          .from('schools')
          .update(schoolData)
          .eq('id', editingSchool.id);

        if (error) throw error;
        toast.success('School updated');
        setSchools(schools.map((s) => (s.id === editingSchool.id ? { ...s, ...schoolData } : s)));
      } else {
        const { data, error } = await supabase.from('schools').insert(schoolData).select().single();

        if (error) throw error;
        toast.success('School added');
        setSchools([...schools, data]);
      }

      resetForm();
    } catch (error) {
      console.error('Error saving school:', error);
      toast.error('Error saving school');
    } finally {
      setIsSaving(false);
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

  const resetForm = () => {
    setEditingSchool(null);
    setFormData({ name: '', logo_url: '' });
    setLogoFile(null);
    setLogoPreview(null);
    setDialogOpen(false);
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
            <h1 className="text-3xl font-bold text-foreground">Schools</h1>
            <p className="text-muted-foreground">Manage schools and their logos</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => resetForm()}>
                <Plus className="h-4 w-4 mr-2" />
                Add School
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSchool ? 'Edit School' : 'Add New School'}</DialogTitle>
              </DialogHeader>
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
                  <div className="flex gap-4 items-start mt-2">
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
                </div>

                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {editingSchool ? 'Update' : 'Add School'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

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
              <Card key={school.id}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
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
                    <div className="flex-1">
                      <h3 className="font-semibold">{school.name}</h3>
                    </div>
                    <div className="flex gap-1">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
