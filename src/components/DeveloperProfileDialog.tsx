import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, MapPin, Code, Briefcase, CheckCircle } from 'lucide-react';

interface DeveloperProfileDialogProps {
  trigger?: React.ReactNode;
}

export function DeveloperProfileDialog({ trigger }: DeveloperProfileDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="link" className="p-0 h-auto text-primary-foreground/80 hover:text-primary-foreground underline">
            View My Profile
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">Brian Mutie</DialogTitle>
          <p className="text-center text-primary font-medium">Professional Web Developer</p>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <p className="text-muted-foreground text-center">
            I am a professional web developer specializing in modern, mobile-first websites and custom business systems.
            I build reliable, easy-to-use digital solutions designed to improve efficiency and drive real business results.
          </p>
          
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
              <Briefcase className="h-5 w-5 text-primary" />
              Services I Offer
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4 text-primary shrink-0" />
                Business and e-commerce websites
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4 text-primary shrink-0" />
                Custom ordering and payment systems
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4 text-primary shrink-0" />
                Admin dashboards and management platforms
              </li>
              <li className="flex items-center gap-2 text-sm">
                <Code className="h-4 w-4 text-primary shrink-0" />
                Mobile-friendly and performance-optimized designs
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-primary" />
              Why Work With Me
            </h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                Clean, professional design standards
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                Strong focus on user experience
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                Systems built for real-world business use
              </li>
              <li className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-success shrink-0" />
                Reliable support and attention to detail
              </li>
            </ul>
          </div>
          
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <a 
              href="mailto:brianmutie777@gmail.com" 
              className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
            >
              <Mail className="h-4 w-4" />
              brianmutie777@gmail.com
            </a>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Available for freelance and business projects
            </p>
          </div>
          
          <p className="text-center text-sm font-medium text-primary italic">
            "Turning business ideas into simple, powerful digital solutions"
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}