-- Script de TESTE e DIAGNÓSTICO para verificar se a função está funcionando
-- Execute este script no Supabase SQL Editor para verificar os dados

-- 1. Verificar quantas transações existem no período
SELECT 
  'Total de transações no período' AS tipo,
  COUNT(*) AS quantidade
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != '';

-- 2. Verificar transações com preço calculado válido
SELECT 
  'Transações com preço válido' AS tipo,
  COUNT(*) AS quantidade
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != ''
  AND t.denominacao_item IS NOT NULL
  AND t.id_empresa IS NOT NULL;

-- 3. Ver algumas transações de exemplo (últimas 10)
SELECT 
  t.id_item_venda_cf,
  t.data_cupom,
  TO_DATE(t.data_cupom, 'DD/MM/YYYY') AS data_convertida,
  t.id_empresa,
  t.denominacao_item,
  t.preco_calculado,
  REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC AS preco_numerico
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != ''
ORDER BY TO_DATE(t.data_cupom, 'DD/MM/YYYY') DESC
LIMIT 10;

-- 4. Testar se a função get_lowest_cost_freight funciona para uma transação de exemplo
-- (Substitua os valores pelos de uma transação real)
SELECT 
  'Teste get_lowest_cost_freight' AS tipo,
  cf.*
FROM public.get_lowest_cost_freight(
  '1170823392'::text,  -- Substitua por um id_empresa real
  'DIESEL S10',        -- Substitua por um produto real
  CURRENT_DATE
) cf;

-- 5. Verificar se há transações onde o preço calculado é muito baixo (possível negativação)
SELECT 
  'Transações com preço < 1.00' AS tipo,
  COUNT(*) AS quantidade
FROM nf.transações t
WHERE 
  t.data_cupom IS NOT NULL 
  AND t.data_cupom != ''
  AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
  AND t.preco_calculado IS NOT NULL 
  AND t.preco_calculado != ''
  AND REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC < 1.00;

-- 6. Verificar distribuição de preços calculados
SELECT 
  'Distribuição de preços' AS tipo,
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

