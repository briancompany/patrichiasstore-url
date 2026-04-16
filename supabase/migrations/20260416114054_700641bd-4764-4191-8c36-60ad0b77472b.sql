
-- Store content settings (singleton row)
CREATE TABLE public.store_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_photo_url text,
  price_chart_url text,
  shop_description text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_content ENABLE ROW LEVEL SECURITY;

-- Anyone can view store content (displayed on public shop page)
CREATE POLICY "Anyone can view store content"
  ON public.store_content FOR SELECT
  USING (true);

-- Admins can insert
CREATE POLICY "Admins can insert store content"
  ON public.store_content FOR INSERT
  WITH CHECK (is_admin());

-- Admins can update
CREATE POLICY "Admins can update store content"
  ON public.store_content FOR UPDATE
  USING (is_admin());

-- Admins can delete
CREATE POLICY "Admins can delete store content"
  ON public.store_content FOR DELETE
  USING (is_admin());

-- Trigger for updated_at
CREATE TRIGGER update_store_content_updated_at
  BEFORE UPDATE ON public.store_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default row
INSERT INTO public.store_content (shop_description)
VALUES ('Important Notice to Our Customers

To ensure accuracy, please refer to our latest price charts for the most updated sizes and pricing. In some cases, recent updates may not yet be fully reflected on the website.

If you notice any differences (for example, size labels like Small, Medium, Large instead of numerical sizes), there is no need to worry—the chart provides the correct and current information.

For any clarification, feel free to contact us directly at 0726 075 180. Our team is always ready to assist you.

Ordering Made Easy

If you prefer not to pay immediately:

Add your items to the cart

Click "Place Order"

Proceed to "Payment"

Your order will still be successfully placed even if you don''t complete the payment step. You can then visit our shop and pay physically at your convenience.

We are committed to making your shopping experience simple, flexible, and reliable.

Thank you for choosing Patrichia Store Uniforms');

-- Storage bucket for store content images
INSERT INTO storage.buckets (id, name, public) VALUES ('store-content', 'store-content', true);

-- Anyone can view store content images
CREATE POLICY "Anyone can view store content images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'store-content');

-- Admins can upload store content images
CREATE POLICY "Admins can upload store content images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'store-content' AND (SELECT is_admin()));

-- Admins can update store content images
CREATE POLICY "Admins can update store content images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'store-content' AND (SELECT is_admin()));

-- Admins can delete store content images
CREATE POLICY "Admins can delete store content images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'store-content' AND (SELECT is_admin()));
