-- Adicionar campo batch_name para nomear lotes
ALTER TABLE public.price_suggestions 
ADD COLUMN IF NOT EXISTS batch_name TEXT;

-- Criar índice para melhorar performance de queries por batch_name
CREATE INDEX IF NOT EXISTS idx_price_suggestions_batch_name ON public.price_suggestions(batch_name);

-- Comentário na coluna
COMMENT ON COLUMN public.price_suggestions.batch_name IS 'Nome do lote - opcional, para identificar facilmente um grupo de solicitações';











