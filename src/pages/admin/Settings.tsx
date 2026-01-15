import { useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Save, MapPin, Phone, Truck, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [settings, setSettings] = useState({
    storeName: "Patrichia's Store",
    storeLocation: 'Uhuru Market, Store F47',
    whatsappNumber: '254700000000',
    openingHours: 'Mon - Sat: 8AM - 6PM',
    deliveryFeeNairobi: 200,
    deliveryFeeOutside: 500,
    enableDelivery: true,
    minOrderForFreeDelivery: 5000,
    welcomeMessage: "Welcome to Patrichia's Store! Quality school uniforms at affordable prices.",
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    // In production, this would save to the database
    await new Promise((resolve) => setTimeout(resolve, 500));
    toast.success('Settings saved successfully');
    setIsSaving(false);
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your store configuration</p>
        </div>

        {/* Store Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Store Information
            </CardTitle>
            <CardDescription>Basic details about your store</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Store Name</Label>
              <Input
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
              />
            </div>
            <div>
              <Label>Location</Label>
              <Input
                value={settings.storeLocation}
                onChange={(e) => setSettings({ ...settings, storeLocation: e.target.value })}
              />
            </div>
            <div>
              <Label>Opening Hours</Label>
              <Input
                value={settings.openingHours}
                onChange={(e) => setSettings({ ...settings, openingHours: e.target.value })}
              />
            </div>
            <div>
              <Label>Welcome Message</Label>
              <Textarea
                value={settings.welcomeMessage}
                onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              WhatsApp Settings
            </CardTitle>
            <CardDescription>Configure your WhatsApp number for orders</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>WhatsApp Number</Label>
              <div className="flex gap-2">
                <Input
                  value={settings.whatsappNumber}
                  onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
                  placeholder="254700000000"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Enter without the + sign. E.g., 254700000000
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" />
              Delivery Settings
            </CardTitle>
            <CardDescription>Configure delivery options and fees</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Delivery</Label>
                <p className="text-sm text-muted-foreground">Allow customers to select delivery option</p>
              </div>
              <Switch
                checked={settings.enableDelivery}
                onCheckedChange={(checked) => setSettings({ ...settings, enableDelivery: checked })}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Nairobi Delivery Fee (Ksh)</Label>
                <Input
                  type="number"
                  value={settings.deliveryFeeNairobi}
                  onChange={(e) =>
                    setSettings({ ...settings, deliveryFeeNairobi: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
              <div>
                <Label>Outside Nairobi Fee (Ksh)</Label>
                <Input
                  type="number"
                  value={settings.deliveryFeeOutside}
                  onChange={(e) =>
                    setSettings({ ...settings, deliveryFeeOutside: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
            </div>

            <div>
              <Label>Free Delivery Minimum (Ksh)</Label>
              <Input
                type="number"
                value={settings.minOrderForFreeDelivery}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minOrderForFreeDelivery: parseInt(e.target.value) || 0,
                  })
                }
                min={0}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set to 0 to disable free delivery
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </AdminLayout>
  );
}
