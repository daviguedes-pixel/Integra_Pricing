-- Migration to add location columns to price_references for map plotting

-- 1. Add arla32_granel to product_type ENUM
ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'arla32_granel';

-- 2. Add columns to price_references
ALTER TABLE public.price_references 
  ADD COLUMN IF NOT EXISTS latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS posto_id TEXT,
  ADD COLUMN IF NOT EXISTS cliente_id TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
