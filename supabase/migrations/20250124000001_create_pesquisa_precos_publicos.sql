-- Criar tabela pesquisa_precos_publicos que está faltando
CREATE TABLE IF NOT EXISTS public.pesquisa_precos_publicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posto_id UUID REFERENCES public.stations(id) NOT NULL,
  produto TEXT NOT NULL,
  preco_pesquisa DECIMAL(10,2) NOT NULL,
  data_pesquisa TIMESTAMP WITH TIME ZONE DEFAULT now(),
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pesquisa_precos_publicos ENABLE ROW LEVEL SECURITY;

-- Políticas para pesquisa_precos_publicos
DROP POLICY IF EXISTS "Users can view pesquisa_precos_publicos" ON public.pesquisa_precos_publicos;
CREATE POLICY "Users can view pesquisa_precos_publicos" 
ON public.pesquisa_precos_publicos 
FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert pesquisa_precos_publicos" ON public.pesquisa_precos_publicos;
CREATE POLICY "Users can insert pesquisa_precos_publicos" 
ON public.pesquisa_precos_publicos 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update pesquisa_precos_publicos" ON public.pesquisa_precos_publicos;
CREATE POLICY "Users can update pesquisa_precos_publicos" 
ON public.pesquisa_precos_publicos 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_pesquisa_precos_publicos_posto_id ON public.pesquisa_precos_publicos(posto_id);
CREATE INDEX IF NOT EXISTS idx_pesquisa_precos_publicos_produto ON public.pesquisa_precos_publicos(produto);
CREATE INDEX IF NOT EXISTS idx_pesquisa_precos_publicos_data ON public.pesquisa_precos_publicos(data_pesquisa);

-- Comentário para documentação
COMMENT ON TABLE public.pesquisa_precos_publicos IS 'Pesquisas de preços públicos dos concorrentes';
