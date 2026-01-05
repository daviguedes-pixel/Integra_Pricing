-- Query para encontrar o menor custo total combinando cotacao_geral_combustivel e cotacao_combustivel
-- Substitua os valores conforme necessário

-- Versão completa: mostra todos os custos ordenados
SELECT 
  'cotacao_geral' AS origem,
  cc.id_base_fornecedor,
  bf.nome AS base_nome,
  bf.codigo_base,
  bf.uf,
  cc.forma_entrega,
  (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
  COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
  CASE 
    WHEN cc.forma_entrega = 'FOB' THEN 
      (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
    ELSE 
      (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
  END AS custo_total,
  cc.data_cotacao,
  fe.frete_real,
  fe.frete_atual
FROM cotacao.cotacao_geral_combustivel cc
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor = cc.id_base_fornecedor
  AND fe.registro_ativo = true
WHERE DATE(cc.data_cotacao) = CURRENT_DATE  -- OU USE UMA DATA ESPECÍFICA
  -- Adicione filtros de produto se necessário:
  -- AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  -- Filtrar apenas FOB com frete OU CIF:
  AND (
    UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
    OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  )

UNION ALL

SELECT 
  'cotacao_combustivel' AS origem,
  cc.id_base_fornecedor,
  bf.nome AS base_nome,
  bf.codigo_base,
  bf.uf,
  cc.forma_entrega,
  (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
  COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
  CASE 
    WHEN cc.forma_entrega = 'FOB' THEN 
      (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
    ELSE 
      (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
  END AS custo_total,
  cc.data_cotacao,
  fe.frete_real,
  fe.frete_atual
FROM cotacao.cotacao_combustivel cc
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
  AND fe.id_base_fornecedor = cc.id_base_fornecedor
  AND fe.registro_ativo = true
WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND DATE(cc.data_cotacao) = CURRENT_DATE  -- OU USE UMA DATA ESPECÍFICA
  -- Adicione filtros de produto se necessário:
  -- AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  -- Filtrar apenas FOB com frete OU CIF:
  AND (
    UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
    OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  )

ORDER BY custo_total ASC;

-- ============================================
-- Versão com filtro de produto (S10 como exemplo):
-- ============================================
SELECT 
  origem,
  id_base_fornecedor,
  base_nome,
  codigo_base,
  uf,
  forma_entrega,
  custo,
  frete,
  custo_total,
  data_cotacao,
  frete_real,
  frete_atual
FROM (
  SELECT 
    'cotacao_geral' AS origem,
    cc.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    bf.uf,
    cc.forma_entrega,
    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
    END AS custo_total,
    cc.data_cotacao,
    fe.frete_real,
    fe.frete_atual
  FROM cotacao.cotacao_geral_combustivel cc
  INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor = cc.id_base_fornecedor
    AND fe.registro_ativo = true
  WHERE DATE(cc.data_cotacao) = CURRENT_DATE
    AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')  -- SUBSTITUA PELO PRODUTO
    AND (
      UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
      OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
    )

  UNION ALL

  SELECT 
    'cotacao_combustivel' AS origem,
    cc.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    bf.uf,
    cc.forma_entrega,
    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
    END AS custo_total,
    cc.data_cotacao,
    fe.frete_real,
    fe.frete_atual
  FROM cotacao.cotacao_combustivel cc
  INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
    AND fe.id_base_fornecedor = cc.id_base_fornecedor
    AND fe.registro_ativo = true
  WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND DATE(cc.data_cotacao) = CURRENT_DATE
    AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')  -- SUBSTITUA PELO PRODUTO
    AND (
      UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
      OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
    )
) combined
ORDER BY custo_total ASC;

-- ============================================
-- Versão que retorna APENAS o menor custo:
-- ============================================
SELECT 
  origem,
  id_base_fornecedor,
  base_nome,
  codigo_base,
  uf,
  forma_entrega,
  custo,
  frete,
  custo_total,
  data_cotacao,
  frete_real,
  frete_atual
FROM (
  SELECT 
    'cotacao_geral' AS origem,
    cc.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    bf.uf,
    cc.forma_entrega,
    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
    END AS custo_total,
    cc.data_cotacao,
    fe.frete_real,
    fe.frete_atual
  FROM cotacao.cotacao_geral_combustivel cc
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_base_fornecedor = cc.id_base_fornecedor
    AND fe.registro_ativo = true
  WHERE DATE(cc.data_cotacao) = CURRENT_DATE
    AND (
      UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
      OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
    )

  UNION ALL

  SELECT 
    'cotacao_combustivel' AS origem,
    cc.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    bf.uf,
    cc.forma_entrega,
    (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cc.forma_entrega = 'FOB' THEN 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cc.valor_unitario - COALESCE(cc.desconto_valor, 0))
    END AS custo_total,
    cc.data_cotacao,
    fe.frete_real,
    fe.frete_atual
  FROM cotacao.cotacao_combustivel cc
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
    AND fe.id_base_fornecedor = cc.id_base_fornecedor
    AND fe.registro_ativo = true
  WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND DATE(cc.data_cotacao) = CURRENT_DATE
    AND (
      UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
      OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
    )
) combined
ORDER BY custo_total ASC
LIMIT 1;

