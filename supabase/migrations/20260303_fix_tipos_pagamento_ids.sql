-- FIX: Regenerar IDs únicos na tabela tipos_pagamento
-- O problema é que a coluna id SERIAL foi adicionada mas todos os registros
-- existentes ficaram com o mesmo valor (ex: id=1)

-- 1) Remover a constraint UNIQUE existente (se houver) para poder atualizar
ALTER TABLE public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_id_unique;
ALTER TABLE public.tipos_pagamento DROP CONSTRAINT IF EXISTS tipos_pagamento_pkey;

-- 2) Gerar IDs únicos sequenciais para TODOS os registros
WITH numbered AS (
  SELECT ctid, ROW_NUMBER() OVER (ORDER BY "CARTAO", "ID_POSTO", "TAXA") as new_id
  FROM public.tipos_pagamento
)
UPDATE public.tipos_pagamento t
SET id = n.new_id::integer
FROM numbered n
WHERE t.ctid = n.ctid;

-- 3) Atualizar a sequência para continuar a partir do último ID
DO $$
DECLARE
  seq_name text;
  max_id integer;
BEGIN
  -- Encontrar nome da sequência
  SELECT pg_get_serial_sequence('public.tipos_pagamento', 'id') INTO seq_name;
  SELECT COALESCE(MAX(id), 0) + 1 INTO max_id FROM public.tipos_pagamento;
  
  IF seq_name IS NOT NULL THEN
    PERFORM setval(seq_name, max_id::bigint, false);
    RAISE NOTICE 'Sequência % atualizada para %', seq_name, max_id;
  ELSE
    -- Se não encontrou sequência, tentar nome padrão
    BEGIN
      PERFORM setval('public.tipos_pagamento_id_seq', max_id::bigint, false);
      RAISE NOTICE 'Sequência padrão atualizada para %', max_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Nenhuma sequência encontrada, pulando setval';
    END;
  END IF;
END $$;

-- 4) Recriar a constraint UNIQUE
ALTER TABLE public.tipos_pagamento ADD CONSTRAINT tipos_pagamento_id_unique UNIQUE (id);

-- 5) Verificar resultado
DO $$
DECLARE
  total_rows INT;
  unique_ids INT;
BEGIN
  SELECT COUNT(*) INTO total_rows FROM public.tipos_pagamento;
  SELECT COUNT(DISTINCT id) INTO unique_ids FROM public.tipos_pagamento;
  
  IF total_rows = unique_ids THEN
    RAISE NOTICE 'SUCESSO: % registros com % IDs unicos', total_rows, unique_ids;
  ELSE
    RAISE WARNING 'FALHA: % registros mas apenas % IDs unicos', total_rows, unique_ids;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
