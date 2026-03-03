-- Adicionar coluna id serial na tabela tipos_pagamento para garantir identificação única
ALTER TABLE public.tipos_pagamento
ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY;

-- Se já existir mas sem ser PRIMARY KEY, garantir que é UNIQUE
-- ALTER TABLE public.tipos_pagamento ADD CONSTRAINT tipos_pagamento_id_unique UNIQUE (id);

COMMENT ON COLUMN public.tipos_pagamento.id IS 'Identificador único auto-incremental para cada registro de tipo de pagamento';

NOTIFY pgrst, 'reload schema';
