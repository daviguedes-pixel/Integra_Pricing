-- Script para verificar a estrutura da tabela nf.transações
-- Execute este script primeiro para descobrir os nomes das colunas

-- Listar todas as colunas da tabela nf.transações
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'nf'
  AND table_name = 'transações'
ORDER BY ordinal_position;

-- Se a tabela tiver um nome diferente (sem acento), tente:
-- SELECT 
--     column_name,
--     data_type,
--     is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'nf'
--   AND table_name LIKE '%trans%'
-- ORDER BY ordinal_position;

