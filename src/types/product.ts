export interface ProductSize {
  size: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  school: string;
  type: 'tshirt' | 'shirts' | 'tracksuit' | 'socks' | 'shorts' | 'trousers' | 'skirt' | 'sweater' | 'tie' | 'dress' | 'fleece_jacket' | 'other';
  image: string;
  sizes: ProductSize[];
  inStock: boolean;
  description?: string;
}

export interface CartItem {
  product: Product;
  selectedSize: string;
  quantity: number;
  price: number;
}

export interface OrderDetails {
  fullName: string;
  phone: string;
  school: string;
  items: CartItem[];
  deliveryType: 'pickup' | 'delivery';
  location?: string;
}
