import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Wand2, Download, RefreshCw, Palette, Type, Shapes } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface LogoCreatorProps {
  schoolName: string;
  onLogoGenerated: (logoUrl: string) => void;
  onClose?: () => void;
}

export function LogoCreator({ schoolName, onLogoGenerated, onClose }: LogoCreatorProps) {
  const [prompt, setPrompt] = useState(`Professional school logo for "${schoolName}" - clean, modern, educational theme with school shield or emblem design. Simple colors, white background.`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const generateLogo = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-logo', {
        body: { prompt, schoolName }
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success('Logo generated successfully!');
      } else {
        throw new Error('No image returned');
      }
    } catch (error) {
      console.error('Error generating logo:', error);
      toast.error('Failed to generate logo. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveAndUseLogo = async () => {
    if (!generatedImage) return;

    setIsUploading(true);
    try {
      // Convert base64 to blob if needed
      let imageBlob: Blob;
      
      if (generatedImage.startsWith('data:')) {
        const base64Data = generatedImage.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        imageBlob = new Blob([byteArray], { type: 'image/png' });
      } else {
        // Fetch from URL
        const response = await fetch(generatedImage);
        imageBlob = await response.blob();
      }

      const fileName = `logo-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
      
      const { error: uploadError } = await supabase.storage
        .from('school-logos')
        .upload(fileName, imageBlob, {
          contentType: 'image/png'
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('school-logos').getPublicUrl(fileName);
      
      onLogoGenerated(urlData.publicUrl);
      toast.success('Logo saved successfully!');
    } catch (error) {
      console.error('Error saving logo:', error);
      toast.error('Failed to save logo');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadLogo = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `${schoolName.replace(/\s+/g, '-').toLowerCase()}-logo.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const presetPrompts = [
    { icon: Shapes, label: 'Shield', prompt: `Professional school shield emblem for "${schoolName}" - classic heraldic design with educational symbols, clean lines, 2-3 colors, white background` },
    { icon: Type, label: 'Modern', prompt: `Modern minimalist school logo for "${schoolName}" - simple geometric shapes, bold typography, professional, white background` },
    { icon: Palette, label: 'Colorful', prompt: `Vibrant school logo for "${schoolName}" - playful yet professional, bright colors, education theme, books or graduation cap, white background` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Wand2 className="h-4 w-4" />
        <span>AI Logo Generator</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {presetPrompts.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => setPrompt(preset.prompt)}
            disabled={isGenerating}
          >
            <preset.icon className="h-3 w-3 mr-1" />
            {preset.label}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="prompt">Logo Description</Label>
        <Textarea
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the logo you want..."
          className="min-h-[80px]"
          disabled={isGenerating}
        />
      </div>

      <Button onClick={generateLogo} disabled={isGenerating} className="w-full">
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Generating...
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4 mr-2" />
            Generate Logo
          </>
        )}
      </Button>

      {generatedImage && (
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-40 h-40 rounded-lg overflow-hidden bg-white border">
                <img 
                  src={generatedImage} 
                  alt="Generated logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex gap-2 w-full">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={generateLogo}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={downloadLogo}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
              <Button 
                onClick={saveAndUseLogo} 
                disabled={isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Use This Logo'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
