-- Query de teste para verificar se a cotação geral está sendo buscada corretamente
-- Execute esta query substituindo os valores pelos do Pedra Preta

-- 1. Primeiro, encontre o id_empresa e verifique se é bandeira branca:
SELECT 
  id_empresa,
  nome_empresa,
  bandeira,
  CASE 
    WHEN bandeira IS NULL OR TRIM(bandeira) = '' OR UPPER(TRIM(bandeira)) LIKE '%BRANCA%' 
    THEN 'SIM - BANDEIRA BRANCA' 
    ELSE 'NÃO' 
  END AS eh_bandeira_branca
FROM cotacao.sis_empresa 
WHERE nome_empresa ILIKE '%PEDRA PRETA%' 
   OR nome_empresa ILIKE '%PEDRA%PRETA%';

-- 2. Verificar se há dados na cotação geral para S10 hoje:
SELECT 
  COUNT(*) AS total_registros,
  COUNT(DISTINCT cg.id_base_fornecedor) AS total_bases,
  MIN(cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS menor_custo,
  MAX(cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS maior_custo
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
WHERE DATE(cg.data_cotacao) = CURRENT_DATE
  AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%');

-- 3. Ver todas as bases da cotação geral com custos (substitua o id_empresa):
/*
WITH custos_gerais AS (
  SELECT 
    bf.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    bf.uf,
    cg.forma_entrega,
    (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cg.forma_entrega = 'FOB' THEN 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
    END AS custo_total,
    cg.data_cotacao,
    CASE 
      WHEN cg.forma_entrega != 'FOB' THEN 'CIF - Sem frete'
      WHEN COALESCE(fe.frete_real, fe.frete_atual, 0) > 0 THEN 'FOB - Com frete cadastrado'
      ELSE 'FOB - SEM frete cadastrado (será filtrado)'
    END AS status_frete
  FROM cotacao.cotacao_geral_combustivel cg
  INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA DO PEDRA PRETA
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
)
SELECT 
  base_nome,
  base_codigo,
  uf,
  forma_entrega,
  custo,
  frete,
  custo_total,
  status_frete,
  data_cotacao
FROM custos_gerais
ORDER BY custo_total ASC;
*/

-- 4. Comparar custos: cotação geral vs cotação específica (substitua o id_empresa):
/*
WITH todos_custos AS (
  -- Cotação geral
  SELECT 
    bf.nome AS base_nome,
    (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
    CASE 
      WHEN cg.forma_entrega = 'FOB' THEN COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 0
    END AS frete,
    CASE 
      WHEN cg.forma_entrega = 'FOB' THEN 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
    END AS custo_total,
    'cotacao_geral' AS origem
  FROM cotacao.cotacao_geral_combustivel cg
  INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
    AND (cg.forma_entrega != 'FOB' OR COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  UNION ALL
  -- Cotação específica (Shell)
  SELECT 
    bf.nome AS base_nome,
    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
    END AS custo_total,
    'cotacao_combustivel (Shell)' AS origem
  FROM cotacao.cotacao_combustivel cc
  INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa
    AND fe.id_base_fornecedor = cc.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND DATE(cc.data_cotacao) = CURRENT_DATE
    AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND (cc.forma_entrega != 'FOB' OR COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
)
SELECT 
  base_nome,
  custo,
  frete,
  custo_total,
  origem
FROM todos_custos
ORDER BY custo_total ASC;
*/

