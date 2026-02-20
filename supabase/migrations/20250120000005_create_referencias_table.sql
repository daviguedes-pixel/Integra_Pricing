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

-- Políticas para referencias
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

DROP POLICY IF EXISTS "Users can update references" ON public.referencias;
CREATE POLICY "Users can update references" 
ON public.referencias 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Função para gerar código de referência único
CREATE OR REPLACE FUNCTION public.generate_reference_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'REF-' || EXTRACT(EPOCH FROM now())::TEXT || '-' || LPAD(FLOOR(RANDOM() * 1000)::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger para gerar código de referência automaticamente
CREATE OR REPLACE FUNCTION public.set_reference_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_referencia IS NULL OR NEW.codigo_referencia = '' THEN
    NEW.codigo_referencia := public.generate_reference_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS set_reference_code_trigger ON public.referencias;
CREATE TRIGGER set_reference_code_trigger
  BEFORE INSERT ON public.referencias
  FOR EACH ROW
  EXECUTE FUNCTION public.set_reference_code();
