-- =============================================
-- MIGRATION: Criar tabela price_references
-- Cotação de preços de referência por produto, município e UF
-- Validade padrão: 7 dias
-- =============================================

-- Criar tabela se não existir
CREATE TABLE IF NOT EXISTS public.price_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto TEXT NOT NULL,               -- 's10', 'diesel_s500', 'arla32_granel', etc.
  municipio TEXT NOT NULL,
  uf TEXT NOT NULL CHECK (length(uf) = 2),
  preco DECIMAL(10,4) NOT NULL,
  fonte TEXT DEFAULT 'manual',         -- 'ocr', 'manual', 'anp'
  anexo_url TEXT,                      -- URL da imagem/PDF de origem
  validade DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  criado_por UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  ativo BOOLEAN DEFAULT true
);

-- Índices para consulta rápida
CREATE INDEX IF NOT EXISTS idx_price_ref_produto_mun ON public.price_references(produto, municipio, uf);
CREATE INDEX IF NOT EXISTS idx_price_ref_validade ON public.price_references(validade) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_price_ref_created ON public.price_references(created_at DESC);

-- Habilitar RLS
ALTER TABLE public.price_references ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view price references" ON public.price_references;
CREATE POLICY "Users can view price references"
ON public.price_references FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated can insert price references" ON public.price_references;
CREATE POLICY "Authenticated can insert price references"
ON public.price_references FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated can update price references" ON public.price_references;
CREATE POLICY "Authenticated can update price references"
ON public.price_references FOR UPDATE USING (auth.role() = 'authenticated');

-- ========================
-- RPC: Buscar referência de preço mais recente válida
-- ========================
CREATE OR REPLACE FUNCTION public.get_price_reference(
  p_produto TEXT,
  p_municipio TEXT,
  p_uf TEXT
)
RETURNS TABLE(
  id UUID,
  preco DECIMAL,
  fonte TEXT,
  created_at TIMESTAMPTZ,
  validade DATE,
  anexo_url TEXT
)
LANGUAGE sql STABLE AS $$
  SELECT id, preco, fonte, created_at, validade, anexo_url
  FROM public.price_references
  WHERE produto = p_produto
    AND municipio ILIKE p_municipio
    AND uf ILIKE p_uf
    AND ativo = true
    AND validade >= CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- ========================
-- RPC: Listar todas as referências ativas (para módulo de referências)
-- ========================
CREATE OR REPLACE FUNCTION public.list_price_references(
  p_produto TEXT DEFAULT NULL,
  p_municipio TEXT DEFAULT NULL,
  p_uf TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  produto TEXT,
  municipio TEXT,
  uf TEXT,
  preco DECIMAL,
  fonte TEXT,
  anexo_url TEXT,
  validade DATE,
  criado_por UUID,
  created_at TIMESTAMPTZ,
  ativo BOOLEAN,
  is_valid BOOLEAN
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, produto, municipio, uf, preco, fonte, anexo_url, validade, criado_por, created_at, ativo,
    (ativo = true AND validade >= CURRENT_DATE) AS is_valid
  FROM public.price_references
  WHERE (p_produto IS NULL OR produto = p_produto)
    AND (p_municipio IS NULL OR municipio ILIKE '%' || p_municipio || '%')
    AND (p_uf IS NULL OR uf ILIKE p_uf)
  ORDER BY created_at DESC
  LIMIT 200;
$$;
