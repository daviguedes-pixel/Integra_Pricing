-- Testar a função diretamente com os parâmetros do Pedra Preta
-- Execute estas queries para verificar se a função está funcionando corretamente

-- 1. Primeiro, encontre o id_empresa e o código/nome exato do Pedra Preta:
SELECT 
  id_empresa,
  nome_empresa,
  cnpj_cpf,
  bandeira
FROM cotacao.sis_empresa 
WHERE nome_empresa ILIKE '%PEDRA PRETA%' 
   OR nome_empresa ILIKE '%PEDRA%PRETA%';

-- 2. Testar a função com diferentes formatos de ID (substitua pelos valores encontrados):
-- Teste 1: Com o nome completo
SELECT * FROM get_lowest_cost_freight('SÃO ROQUE - PEDRA PRETA', 'S10', CURRENT_DATE);

-- Teste 2: Com o código se houver
SELECT * FROM get_lowest_cost_freight('PEDRA PRETA', 'S10', CURRENT_DATE);

-- Teste 3: Com o id_empresa se for usado como código
SELECT * FROM get_lowest_cost_freight('123', 'S10', CURRENT_DATE);  -- SUBSTITUA 123 pelo id_empresa

-- 3. Verificar se a função está identificando como bandeira branca:
-- (Execute a query 1 primeiro para pegar o id_empresa, depois execute esta)
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
WHERE id_empresa = 123;  -- SUBSTITUA 123 pelo id_empresa encontrado

-- 4. Verificar se há dados na cotação geral para a data de hoje:
SELECT 
  COUNT(*) AS total,
  MIN(cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS menor_custo,
  MAX(cg.valor_unitario - COALESCE(cg.desconto_valor, 0)) AS maior_custo
FROM cotacao.cotacao_geral_combustivel cg
INNER JOIN cotacao.grupo_codigo_item gci ON cg.id_grupo_codigo_item = gci.id_grupo_codigo_item
WHERE DATE(cg.data_cotacao) = CURRENT_DATE
  AND (gci.nome ILIKE '%S10%' OR gci.descricao ILIKE '%S10%');

