-- ============================================
-- QUERIES EXECUTÁVEIS PARA DEBUG
-- ============================================

-- 1. Encontrar o id_empresa do Pedra Preta e verificar se é bandeira branca:
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

-- 2. Verificar quantas bases da cotação geral têm frete cadastrado (SUBSTITUA 123 pelo id_empresa encontrado acima):
SELECT 
  COUNT(*) AS total_bases_cotacao_geral,
  COUNT(DISTINCT CASE WHEN cg.forma_entrega = 'CIF' THEN cg.id_base_fornecedor END) AS bases_cif,
  COUNT(DISTINCT CASE WHEN cg.forma_entrega = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0 THEN cg.id_base_fornecedor END) AS bases_fob_com_frete,
  COUNT(DISTINCT CASE WHEN cg.forma_entrega = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) = 0 THEN cg.id_base_fornecedor END) AS bases_fob_sem_frete,
  MIN(CASE WHEN cg.forma_entrega = 'CIF' THEN (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) END) AS menor_custo_cif,
  MIN(CASE WHEN cg.forma_entrega = 'FOB' AND COALESCE(fe.frete_real, fe.frete_atual, 0) > 0 
           THEN (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0) 
      END) AS menor_custo_total_fob
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123
  AND fe.id_base_fornecedor = cg.id_base_fornecedor 
  AND fe.registro_ativo = true
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE;

-- 3. Ver as 10 bases com menor custo total (incluindo frete) da cotação geral (SUBSTITUA 123 pelo id_empresa):
WITH custos_completos AS (
  SELECT 
    bf.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base,
    cg.forma_entrega,
    (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
    COALESCE(fe.frete_real, fe.frete_atual, 0) AS frete,
    CASE 
      WHEN cg.forma_entrega = 'FOB' THEN 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) + COALESCE(fe.frete_real, fe.frete_atual, 0)
      ELSE 
        (cg.valor_unitario - COALESCE(cg.desconto_valor, 0))
    END AS custo_total,
    CASE 
      WHEN cg.forma_entrega = 'CIF' THEN 'CIF - Sem frete'
      WHEN COALESCE(fe.frete_real, fe.frete_atual, 0) > 0 THEN 'FOB - Com frete'
      ELSE 'FOB - SEM frete (será filtrado)'
    END AS status
  FROM cotacao.cotacao_geral_combustivel cg
  INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
)
SELECT 
  base_nome,
  codigo_base,
  forma_entrega,
  custo,
  frete,
  custo_total,
  status
FROM custos_completos
WHERE status != 'FOB - SEM frete (será filtrado)'
ORDER BY custo_total ASC
LIMIT 10;

-- 4. Comparar custos: cotação geral vs cotação específica (Shell) - SUBSTITUA 123 pelo id_empresa:
WITH todos_custos AS (
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
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
    AND (cg.forma_entrega != 'FOB' OR COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
  UNION ALL
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
  WHERE cc.id_empresa = 123
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

