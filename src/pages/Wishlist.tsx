import { Layout } from '@/components/layout/Layout';
import { ProductCard } from '@/components/ProductCard';
import { useWishlist } from '@/hooks/useWishlist';
import { products } from '@/data/products';
import { useGeneralProducts } from '@/hooks/useProductCache';
import { useMemo } from 'react';
import { Product } from '@/types/product';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function Wishlist() {
  const { wishlist } = useWishlist();
  const navigate = useNavigate();
  const { products: rawGeneral } = useGeneralProducts();

  const generalProducts: Product[] = useMemo(() => {
    return rawGeneral.map((p) => ({
      id: p.id,
      name: p.name,
      school: 'General',
      type: (p.type === 'other' ? 'tshirt' : p.type) as Product['type'],
      image: p.image_url || '/placeholder.svg',
      sizes: p.sizes,
      inStock: p.in_stock,
      description: p.description || undefined,
    }));
  }, [rawGeneral]);

  const allProducts = useMemo(() => [...generalProducts, ...products], [generalProducts]);
  const wishlisted = allProducts.filter((p) => wishlist.includes(p.id));

  const handleAddToCart = () => {};

  return (
    <Layout>
      <div className="container-shop py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
            <Heart className="h-8 w-8 text-red-500 fill-red-500" />
            My Wishlist
          </h1>
          <p className="text-muted-foreground">{wishlisted.length} saved items</p>
        </div>

        {wishlisted.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <Heart className="h-16 w-16 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground text-lg">Your wishlist is empty</p>
            <Button onClick={() => navigate('/shop')}>Browse Products</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {wishlisted.map((product) => (
              <ProductCard key={product.id} product={product} onAddToCart={handleAddToCart} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
