
-- Allow authenticated (staff) to upload and read within the quotations bucket
CREATE POLICY "Staff can upload quotation pdfs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'quotations');

CREATE POLICY "Staff can read quotation pdfs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'quotations');

CREATE POLICY "Staff can update quotation pdfs"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'quotations');

CREATE POLICY "Staff can delete quotation pdfs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'quotations');

-- Persist the signed pdf url for quick re-share (nullable)
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS pdf_path TEXT;
