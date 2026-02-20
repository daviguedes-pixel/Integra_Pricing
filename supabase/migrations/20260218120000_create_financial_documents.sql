-- Create enum types for financial documents
CREATE TYPE public.document_type AS ENUM ('boleto', 'nfe', 'nfse', 'other');
CREATE TYPE public.payment_status AS ENUM ('pending', 'scheduled', 'paid', 'cancelled');

-- Create table for financial documents
CREATE TABLE IF NOT EXISTS public.financial_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type public.document_type NOT NULL,
    
    -- Metadata from file upload
    file_url TEXT,
    original_filename TEXT,
    
    -- Extracted Data
    issuer_name TEXT,
    issuer_cnpj TEXT,
    buyer_name TEXT,
    buyer_cnpj TEXT,
    
    document_number TEXT, -- Number of the NF or Boleto
    barcode TEXT, -- Specifically for Boletos
    digitable_line TEXT, -- Specifically for Boletos
    
    issue_date DATE,
    due_date DATE,
    amount DECIMAL(15, 2),
    
    -- Correlation
    RELATED_DOCUMENT_ID UUID REFERENCES public.financial_documents(id), -- To link Boleto to NF
    
    status public.payment_status DEFAULT 'pending',
    verified BOOLEAN DEFAULT false, -- If the extracted data has been verified by a user
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.financial_documents ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view financial documents" 
ON public.financial_documents 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert financial documents" 
ON public.financial_documents 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update financial documents" 
ON public.financial_documents 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Create index for faster lookups
CREATE INDEX idx_financial_docs_issuer_cnpj ON public.financial_documents(issuer_cnpj);
CREATE INDEX idx_financial_docs_due_date ON public.financial_documents(due_date);
CREATE INDEX idx_financial_docs_status ON public.financial_documents(status);
