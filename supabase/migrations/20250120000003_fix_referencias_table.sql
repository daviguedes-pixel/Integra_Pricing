-- Garantir que a tabela referencias existe e tem a estrutura correta

-- Criar tabela referencias se não existir
CREATE TABLE IF NOT EXISTS public.referencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_referencia TEXT UNIQUE NOT NULL,
  posto_id UUID REFERENCES public.stations(id) NOT NULL,
  cliente_id UUID REFERENCES public.clients(id) NOT NULL,
  produto public.product_type NOT NULL,
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

-- Garantir que a tabela price_suggestions tem a estrutura correta
DO $$ 
BEGIN
  -- Adicionar coluna id se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'id') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
  
  -- Adicionar coluna attachments se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'price_suggestions' AND column_name = 'attachments') THEN
    ALTER TABLE public.price_suggestions ADD COLUMN attachments TEXT[];
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

-- Garantir que a tabela user_profiles tem a estrutura correta
DO $$ 
BEGIN
  -- Adicionar coluna max_approval_margin se não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'user_profiles' AND column_name = 'max_approval_margin') THEN
    ALTER TABLE public.user_profiles ADD COLUMN max_approval_margin INTEGER DEFAULT 0;
  END IF;
END $$;

-- Inserir dados de exemplo se não existirem
INSERT INTO public.referencias (
  codigo_referencia,
  posto_id,
  cliente_id,
  produto,
  preco_referencia,
  tipo_pagamento_id,
  observacoes,
  criado_por
) 
SELECT 
  'REF-' || EXTRACT(EPOCH FROM now())::TEXT,
  s.id,
  c.id,
  'gasolina_comum',
  5.50,
  pm.id,
  'Referência de exemplo',
  (SELECT id FROM auth.users LIMIT 1)
FROM public.stations s
CROSS JOIN public.clients c
CROSS JOIN public.payment_methods pm
WHERE pm.type = 'vista'
LIMIT 1
ON CONFLICT (codigo_referencia) DO NOTHING;

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
