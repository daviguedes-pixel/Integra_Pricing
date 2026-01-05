-- Query de debug para verificar todos os custos disponíveis para um posto
-- Use esta query para verificar se há custos mais baratos na cotação geral
-- Substitua 'PEDRA PRETA' pelo nome do posto e 'S10' pelo produto

-- Exemplo de uso:
-- 1. Primeiro, encontre o id_empresa do posto:
SELECT 
  se.id_empresa,
  se.nome_empresa,
  se.bandeira,
  CASE 
    WHEN se.bandeira IS NULL OR TRIM(se.bandeira) = '' OR UPPER(TRIM(se.bandeira)) LIKE '%BRANCA%' 
    THEN 'SIM - BANDEIRA BRANCA' 
    ELSE 'NÃO' 
  END AS eh_bandeira_branca
FROM cotacao.sis_empresa se
WHERE se.nome_empresa ILIKE '%PEDRA PRETA%'
   OR se.nome_empresa ILIKE '%PEDRA%PRETA%'
LIMIT 10;

-- 2. Depois, use o id_empresa encontrado para ver todos os custos:
-- (Substitua 123 pelo id_empresa encontrado acima)
/*
WITH todos_custos AS (
  -- Cotação específica (Shell, etc)
  SELECT 
    bf.nome AS base_nome,
    (cc.valor_unitario-COALESCE(cc.desconto_valor,0))::numeric AS custo,
    COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
    CASE WHEN cc.forma_entrega='FOB' THEN (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0) 
         ELSE (cc.valor_unitario-COALESCE(cc.desconto_valor,0)) END AS custo_total,
    cc.forma_entrega,
    cc.data_cotacao,
    'cotacao_combustivel (Shell)' AS origem
  FROM cotacao.cotacao_combustivel cc
  INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item=gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=cc.id_empresa AND fe.id_base_fornecedor=cc.id_base_fornecedor AND fe.registro_ativo=true
  WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND DATE(cc.data_cotacao) = CURRENT_DATE
    AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND (cc.forma_entrega != 'FOB' OR COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
  UNION ALL
  -- Cotação geral (mais barata para bandeiras brancas)
  SELECT 
    bf.nome AS base_nome,
    (cg.valor_unitario-COALESCE(cg.desconto_valor,0))::numeric AS custo,
    COALESCE(fe.frete_real,fe.frete_atual,0)::numeric AS frete,
    CASE WHEN cg.forma_entrega='FOB' THEN (cg.valor_unitario-COALESCE(cg.desconto_valor,0)) + COALESCE(fe.frete_real,fe.frete_atual,0) 
         ELSE (cg.valor_unitario-COALESCE(cg.desconto_valor,0)) END AS custo_total,
    cg.forma_entrega,
    cg.data_cotacao,
    'cotacao_geral_combustivel' AS origem
  FROM cotacao.cotacao_geral_combustivel cg
  INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item=gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor=cg.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa=123 AND fe.id_base_fornecedor=cg.id_base_fornecedor AND fe.registro_ativo=true  -- SUBSTITUA PELO ID_EMPRESA
  WHERE DATE(cg.data_cotacao) = CURRENT_DATE
    AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND (cg.forma_entrega != 'FOB' OR COALESCE(fe.frete_real,fe.frete_atual,0) > 0)
)
SELECT 
  base_nome,
  custo,
  frete,
  custo_total,
  forma_entrega,
  data_cotacao,
  origem
FROM todos_custos
ORDER BY custo_total ASC;
*/

