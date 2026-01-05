-- Script para VER TODAS as transações do período (não apenas negativadas)
-- Use para comparar e verificar se a função está filtrando corretamente
-- Execute este script no Supabase SQL Editor

-- Ver todas as transações do período com preço calculado
SELECT 
  t.id_item_venda_cf AS id_transacao,
  TO_DATE(t.data_cupom, 'DD/MM/YYYY') AS data_transacao,
  t.id_empresa AS posto_id,
  t.id_cliente AS cliente_id,
  t.denominacao_item AS produto,
  t.preco_calculado AS preco_calculado_texto,
  REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC AS preco_calculado_numerico,
  t.data_cupom
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != ''
  AND t.denominacao_item IS NOT NULL
  AND t.id_empresa IS NOT NULL
ORDER BY TO_DATE(t.data_cupom, 'DD/MM/YYYY') DESC
LIMIT 100;

-- Ver estatísticas gerais
SELECT 
  COUNT(*) AS total_transacoes,
  COUNT(DISTINCT t.id_empresa) AS total_postos,
  COUNT(DISTINCT t.denominacao_item) AS total_produtos,
  MIN(REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC) AS preco_minimo,
  MAX(REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC) AS preco_maximo,
  AVG(REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC) AS preco_medio
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != '';

