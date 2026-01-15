import { Link } from 'react-router-dom';
import { LucideIcon } from 'lucide-react';

interface CategoryCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}

export function CategoryCard({ title, description, icon: Icon, href }: CategoryCardProps) {
  return (
    <Link to={href} className="group">
      <div className="card-product p-6 text-center hover:border-primary/30 transition-all duration-300 group-hover:-translate-y-1">
        <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center group-hover:bg-primary/20 transition-colors">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
