-- Query para verificar a estrutura e dados da cotacao_geral_combustivel
-- Execute estas queries para entender como os dados estão organizados

-- 1. Ver estrutura da tabela (colunas disponíveis)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'cotacao'
  AND table_name = 'cotacao_geral_combustivel'
ORDER BY ordinal_position;

-- 2. Ver exemplos de dados da cotação geral para S10
SELECT 
  cg.*,
  gci.nome AS produto_nome,
  gci.descricao AS produto_descricao,
  bf.nome AS base_nome,
  bf.codigo_base,
  bf.uf
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE
ORDER BY (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) ASC
LIMIT 20;

-- 3. Ver todas as bases disponíveis na cotação geral com seus custos
SELECT 
  bf.id_base_fornecedor,
  bf.nome AS base_nome,
  bf.codigo_base,
  bf.uf,
  cg.forma_entrega,
  (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS custo,
  cg.data_cotacao,
  gci.nome AS produto
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
  AND DATE(cg.data_cotacao) = CURRENT_DATE
ORDER BY (cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) ASC;

-- 4. Ver fretes cadastrados para um posto específico (substitua o id_empresa)
-- Primeiro encontre o id_empresa do Pedra Preta:
SELECT id_empresa, nome_empresa, bandeira 
FROM cotacao.sis_empresa 
WHERE nome_empresa ILIKE '%PEDRA PRETA%' 
   OR nome_empresa ILIKE '%PEDRA%PRETA%';

-- Depois use o id_empresa encontrado para ver os fretes:
/*
SELECT 
  fe.id_empresa,
  fe.id_base_fornecedor,
  bf.nome AS base_nome,
  fe.frete_real,
  fe.frete_atual,
  fe.registro_ativo
FROM cotacao.frete_empresa fe
LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = fe.id_base_fornecedor
WHERE fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA DO PEDRA PRETA
  AND fe.registro_ativo = true
ORDER BY bf.nome;
*/

-- 5. Ver custos totais (custo + frete) da cotação geral para um posto específico
-- (Substitua o id_empresa pelo encontrado acima)
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
    cg.data_cotacao
  FROM cotacao.cotacao_geral_combustivel cg
  INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
  LEFT JOIN cotacao.base_fornecedor bf ON bf.id_base_fornecedor = cg.id_base_fornecedor
  LEFT JOIN cotacao.frete_empresa fe ON fe.id_empresa = 123  -- SUBSTITUA PELO ID_EMPRESA
    AND fe.id_base_fornecedor = cg.id_base_fornecedor 
    AND fe.registro_ativo = true
  WHERE (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%')
    AND DATE(cg.data_cotacao) = CURRENT_DATE
    AND (cg.forma_entrega != 'FOB' OR COALESCE(fe.frete_real, fe.frete_atual, 0) > 0)
)
SELECT * FROM custos_gerais
ORDER BY custo_total ASC;
*/

