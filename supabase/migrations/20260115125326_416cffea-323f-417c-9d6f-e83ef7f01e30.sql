-- Create enums for roles and order status
CREATE TYPE public.user_role AS ENUM ('admin', 'customer');
CREATE TYPE public.order_status AS ENUM ('pending', 'ready', 'completed');
CREATE TYPE public.delivery_type AS ENUM ('pickup', 'delivery');
CREATE TYPE public.uniform_type AS ENUM ('tshirt', 'tracksuit', 'socks', 'shorts', 'skirt', 'sweater', 'other');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create schools table
CREATE TABLE public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table with sizes as JSONB
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type uniform_type NOT NULL DEFAULT 'tshirt',
  description TEXT,
  image_url TEXT,
  sizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  in_stock BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_school TEXT,
  delivery_type delivery_type NOT NULL DEFAULT 'pickup',
  delivery_location TEXT,
  status order_status NOT NULL DEFAULT 'pending',
  total_amount INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  school_name TEXT,
  size TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_purchase INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Only admins can update profiles" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- Schools policies (public read, admin write)
CREATE POLICY "Anyone can view schools" ON public.schools
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert schools" ON public.schools
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update schools" ON public.schools
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete schools" ON public.schools
  FOR DELETE USING (public.is_admin());

-- Products policies (public read, admin write)
CREATE POLICY "Anyone can view products" ON public.products
  FOR SELECT USING (true);

CREATE POLICY "Admins can insert products" ON public.products
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE USING (public.is_admin());

-- Orders policies (admin only)
CREATE POLICY "Admins can view orders" ON public.orders
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert orders" ON public.orders
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete orders" ON public.orders
  FOR DELETE USING (public.is_admin());

-- Order items policies (admin only)
CREATE POLICY "Admins can view order items" ON public.order_items
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert order items" ON public.order_items
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update order items" ON public.order_items
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins can delete order items" ON public.order_items
  FOR DELETE USING (public.is_admin());

-- Create storage buckets for images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('school-logos', 'school-logos', true);

-- Storage policies for product images
CREATE POLICY "Anyone can view product images" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Admins can upload product images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admins can update product images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "Admins can delete product images" ON storage.objects
  FOR DELETE USING (bucket_id = 'product-images' AND public.is_admin());

-- Storage policies for school logos
CREATE POLICY "Anyone can view school logos" ON storage.objects
  FOR SELECT USING (bucket_id = 'school-logos');

CREATE POLICY "Admins can upload school logos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'school-logos' AND public.is_admin());

CREATE POLICY "Admins can update school logos" ON storage.objects
  FOR UPDATE USING (bucket_id = 'school-logos' AND public.is_admin());

CREATE POLICY "Admins can delete school logos" ON storage.objects
  FOR DELETE USING (bucket_id = 'school-logos' AND public.is_admin());

-- Insert some initial schools
INSERT INTO public.schools (name) VALUES 
  ('Nairobi Primary School'),
  ('Uhuru Academy'),
  ('All Schools');

-- Create index for better query performance
CREATE INDEX idx_products_school_id ON public.products(school_id);
CREATE INDEX idx_products_type ON public.products(type);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);