-- Script para COMPARAR preço calculado vs custo do dia
-- Mostra TODAS as transações com seus custos (não apenas negativadas)
-- Execute este script no Supabase SQL Editor

WITH transacoes_sample AS (
  SELECT 
    t.id_item_venda_cf,
    TO_DATE(t.data_cupom, 'DD/MM/YYYY') AS data_transacao,
    t.id_empresa,
    t.denominacao_item,
    REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC AS preco_calculado
  FROM nf.transações t
  WHERE 
    t.data_cupom IS NOT NULL 
    AND t.data_cupom != ''
    AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
    AND t.preco_calculado IS NOT NULL 
    AND t.preco_calculado != ''
    AND t.denominacao_item IS NOT NULL
    AND t.id_empresa IS NOT NULL
  LIMIT 50  -- Limitar a 50 para teste rápido
)
SELECT 
  ts.id_item_venda_cf,
  ts.data_transacao,
  ts.id_empresa,
  ts.denominacao_item,
  ts.preco_calculado,
  COALESCE(cf.custo_total, 0) AS custo_dia,
  (ts.preco_calculado - COALESCE(cf.custo_total, 0)) AS diferenca,
  CASE 
    WHEN ts.preco_calculado < COALESCE(cf.custo_total, 0) THEN 'NEGATIVADO'
    WHEN ts.preco_calculado = COALESCE(cf.custo_total, 0) THEN 'ZERADO'
    ELSE 'POSITIVO'
  END AS status
FROM transacoes_sample ts
LEFT JOIN LATERAL (
  SELECT custo_total
  FROM public.get_lowest_cost_freight(
    ts.id_empresa::text,
    ts.denominacao_item,
    ts.data_transacao
  )
  LIMIT 1
) cf ON true
ORDER BY ts.data_transacao DESC, ts.preco_calculado ASC;

