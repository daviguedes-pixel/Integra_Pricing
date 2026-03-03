-- Abordagem robusta: adicionar id serial sem depender de PRIMARY KEY
-- Se a tabela já tiver PK, usar UNIQUE ao invés de PRIMARY KEY

DO $$
BEGIN
    -- Verificar se a coluna id já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'tipos_pagamento' 
        AND column_name = 'id'
    ) THEN
        -- Adicionar coluna id com sequência auto-incremento
        ALTER TABLE public.tipos_pagamento ADD COLUMN id SERIAL;
        
        -- Tentar adicionar como UNIQUE (mais seguro que PRIMARY KEY)
        ALTER TABLE public.tipos_pagamento ADD CONSTRAINT tipos_pagamento_id_unique UNIQUE (id);
        
        RAISE NOTICE 'Coluna id adicionada com sucesso à tabela tipos_pagamento';
    ELSE
        RAISE NOTICE 'Coluna id já existe na tabela tipos_pagamento';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
