-- Criar tabela price_history para armazenar histórico de alterações de preço
CREATE TABLE IF NOT EXISTS public.price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID REFERENCES public.price_suggestions(id) ON DELETE SET NULL,
  station_id BIGINT,
  client_id BIGINT,
  product TEXT NOT NULL,
  old_price NUMERIC(10, 4),
  new_price NUMERIC(10, 4) NOT NULL,
  margin_cents NUMERIC(10, 2) DEFAULT 0,
  approved_by TEXT,
  change_type TEXT CHECK (change_type IN ('up', 'down', NULL)),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índices para melhorar performance
CREATE INDEX IF NOT EXISTS idx_price_history_station_client_product 
  ON public.price_history(station_id, client_id, product);
  
CREATE INDEX IF NOT EXISTS idx_price_history_created_at 
  ON public.price_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_suggestion_id 
  ON public.price_history(suggestion_id);

-- Habilitar RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Criar políticas de acesso
CREATE POLICY "Allow authenticated users to read price_history"
  ON public.price_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert price_history"
  ON public.price_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Comentário na tabela
COMMENT ON TABLE public.price_history IS 'Histórico de alterações de preços aprovados';
