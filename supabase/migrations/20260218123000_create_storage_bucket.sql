-- Create storage bucket for financial documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('financial-documents', 'financial-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Policy to allow authenticated users to upload
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'financial-documents' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to select (read)
CREATE POLICY "Authenticated users can select"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'financial-documents' AND
  auth.role() = 'authenticated'
);

-- Policy to allow authenticated users to upate
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'financial-documents' AND
  auth.role() = 'authenticated'
);
