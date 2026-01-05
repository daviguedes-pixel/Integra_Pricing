-- Alterar colunas de ID para TEXT em commercial_proposals para suportar IDs legados
-- Remover chaves estrangeiras que exigem UUID

DO $$ 
BEGIN
    -- client_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commercial_proposals' AND column_name = 'client_id') THEN
        -- Remover FK se existir
        ALTER TABLE public.commercial_proposals DROP CONSTRAINT IF EXISTS commercial_proposals_client_id_fkey;
        -- Alterar tipo para TEXT
        ALTER TABLE public.commercial_proposals ALTER COLUMN client_id TYPE text USING client_id::text;
    END IF;

    -- payment_method_id
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'commercial_proposals' AND column_name = 'payment_method_id') THEN
        -- Remover FK se existir
        ALTER TABLE public.commercial_proposals DROP CONSTRAINT IF EXISTS commercial_proposals_payment_method_id_fkey;
        -- Alterar tipo para TEXT
        ALTER TABLE public.commercial_proposals ALTER COLUMN payment_method_id TYPE text USING payment_method_id::text;
    END IF;
END $$;
