-- Debug: Verificar por que FOB está aparecendo sem frete
-- Execute substituindo 123 pelo id_empresa do Pedra Preta

-- 1. Ver todas as bases FOB da cotação geral e seus fretes:
SELECT 
  bf.id_base_fornecedor,
  bf.nome AS base_nome,
  bf.codigo_base,
  cg.forma_entrega,
  COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete_cadastrado,
  (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
  CASE 
    WHEN cg.forma_entrega = 'FOB' THEN 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
    ELSE 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
  END AS custo_total,
  CASE 
    WHEN cg.forma_entrega = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0 THEN 'FOB COM FRETE ✅'
    WHEN cg.forma_entrega = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) = 0 THEN 'FOB SEM FRETE ❌ (deveria ser filtrado)'
    WHEN cg.forma_entrega = 'CIF' THEN 'CIF ✅'
    ELSE 'OUTRO'
  END AS status
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND fe.id_base_fornecedor = cg.id_base_fornecedor 
  AND fe.registro_ativo = true
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE
ORDER BY 
  CASE 
    WHEN cg.forma_entrega = 'FOB' THEN 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
    ELSE 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
  END ASC;

-- 2. Verificar especificamente a base de UBERLÂNDIA - MG (id_base_fornecedor = 387):
SELECT 
  bf.id_base_fornecedor,
  bf.nome AS base_nome,
  cg.forma_entrega,
  fe.id_empresa AS frete_id_empresa,
  fe.frete_real,
  fe.frete_atual,
  fe.registro_ativo,
  COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete_calculado
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND fe.id_base_fornecedor = cg.id_base_fornecedor 
  AND fe.registro_ativo = true
WHERE bf.id_base_fornecedor = 387
  AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE;

-- 3. Verificar bases de Rondonópolis com frete cadastrado:
SELECT 
  bf.id_base_fornecedor,
  bf.nome AS base_nome,
  bf.codigo_base,
  cg.forma_entrega,
  COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete_cadastrado,
  (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
  CASE 
    WHEN cg.forma_entrega = 'FOB' THEN 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
    ELSE 
      (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
  END AS custo_total
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
  AND fe.id_base_fornecedor = cg.id_base_fornecedor 
  AND fe.registro_ativo = true
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE
  AND (bf.nome ILIKE '%RONDONÓPOLIS%' OR bf.nome ILIKE '%RONDONOPOLIS%')
  AND cg.forma_entrega = 'FOB'
  AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0
ORDER BY custo_total ASC;

