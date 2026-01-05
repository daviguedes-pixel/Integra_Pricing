-- Query para encontrar o menor custo total (custo + frete) da cotacao_combustivel
-- Substitua os valores conforme necessário

-- 1. Ver todos os custos com frete calculado:
SELECT 
  cc.id_empresa,
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
  cc.data_cotacao
FROM cotacao.cotacao_combustivel cc
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
  AND fe.id_base_fornecedor = cc.id_base_fornecedor
  AND fe.registro_ativo = true
WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND DATE(cc.data_cotacao) = CURRENT_DATE  -- OU USE UMA DATA ESPECÍFICA
  -- Adicione filtros de produto se necessário:
  -- AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
ORDER BY custo_total ASC;

-- 2. Retornar APENAS o menor custo total:
SELECT 
  cc.id_empresa,
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
  cc.data_cotacao
FROM cotacao.cotacao_combustivel cc
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
  AND fe.id_base_fornecedor = cc.id_base_fornecedor
  AND fe.registro_ativo = true
WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND DATE(cc.data_cotacao) = CURRENT_DATE  -- OU USE UMA DATA ESPECÍFICA
  -- Filtrar apenas FOB com frete OU CIF:
  AND (
    UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
    OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  )
  -- Adicione filtros de produto se necessário:
  -- AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
ORDER BY custo_total ASC
LIMIT 1;

-- 3. Versão com filtro de produto (S10 como exemplo):
SELECT 
  cc.id_empresa,
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
  gci.nome AS produto_nome,
  gci.descricao AS produto_descricao
FROM cotacao.cotacao_combustivel cc
INNER JOIN cotacao.grupo_codigo_item gci ON cc.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cc.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = cc.id_empresa 
  AND fe.id_base_fornecedor = cc.id_base_fornecedor
  AND fe.registro_ativo = true
WHERE cc.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND DATE(cc.data_cotacao) = CURRENT_DATE  -- OU USE UMA DATA ESPECÍFICA
  AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')  -- SUBSTITUA PELO PRODUTO
  -- Filtrar apenas FOB com frete OU CIF:
  AND (
    UPPER(TRIM(cc.forma_entrega)) = 'CIF' 
    OR (UPPER(TRIM(cc.forma_entrega)) = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  )
ORDER BY custo_total ASC
LIMIT 1;

