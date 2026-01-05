-- Query para verificar quantas bases da cotação geral têm frete cadastrado para um posto
-- Execute esta query substituindo o id_empresa pelo do Pedra Preta

-- 1. Ver quantas bases da cotação geral têm frete cadastrado:
/*
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
LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA DO PEDRA PRETA
  AND fe.id_base_fornecedor = cg.id_base_fornecedor 
  AND fe.registro_ativo = true
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE;
*/

-- 2. Ver as 10 bases com menor custo total (incluindo frete) da cotação geral:
/*
WITH custos_completos AS (
  SELECT 
    bf.id_base_fornecedor,
    bf.nome AS base_nome,
    bf.codigo_base AS codigo_base,
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
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
)
SELECT 
  base_nome,
  codigo_base AS base_codigo,
  forma_entrega,
  custo,
  frete,
  custo_total,
  status
FROM custos_completos
WHERE status != 'FOB - SEM frete (será filtrado)'  -- Filtrar apenas as que serão consideradas
ORDER BY custo_total ASC
LIMIT 10;
*/

