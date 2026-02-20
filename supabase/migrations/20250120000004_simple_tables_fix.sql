-- Migração simples para garantir que as tabelas essenciais existem

-- Criar tabela referencias se não existir
CREATE TABLE IF NOT EXISTS public.referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_referencia TEXT UNIQUE NOT NULL DEFAULT 'REF-' || EXTRACT(EPOCH FROM now())::TEXT,
  posto_id UUID REFERENCES public.stations(id) NOT NULL,
  cliente_id UUID REFERENCES public.clients(id) NOT NULL,
  produto TEXT NOT NULL,
  preco_referencia DECIMAL(10,2) NOT NULL,
  tipo_pagamento_id UUID REFERENCES public.payment_methods(id),
  observacoes TEXT,
  anexo TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para referencias
DROP POLICY IF EXISTS "Users can view references" ON public.referencias;
CREATE POLICY "Users can view references" 
ON public.referencias 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert references" ON public.referencias;
CREATE POLICY "Users can insert references" 
ON public.referencias 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Garantir que a tabela price_suggestions tem as colunas necessárias
DO $$ 
BEGIN
  -- Adicionar coluna id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'id') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  
  -- Adicionar coluna reference_id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'reference_id') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN reference_id UUID REFERENCES public.referencias(id);
  END IF;
  
  -- Adicionar coluna automatically_approved se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'automatically_approved') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN automatically_approved BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Garantir que a tabela user_profiles tem a coluna max_approval_margin
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'max_approval_margin') THEN
    ALTER TABLE public.user_profiles ADD COLUMN max_approval_margin INTEGER DEFAULT 0;
  END IF;
END $$;
