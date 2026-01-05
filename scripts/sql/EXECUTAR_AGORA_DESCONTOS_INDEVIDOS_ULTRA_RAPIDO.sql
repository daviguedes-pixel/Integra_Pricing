-- Script ULTRA OTIMIZADO para processar milhares de transações rapidamente
-- Usa processamento em lote e cache de custos para máxima performance
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a função se já existir
DROP FUNCTION IF EXISTS public.get_descontos_indevidos(DATE, DATE);

-- Criar a função ultra otimizada
CREATE OR REPLACE FUNCTION public.get_descontos_indevidos(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL
)
RETURNS TABLE(
  id_transacao BIGINT,
  data_transacao DATE,
  posto_id BIGINT,
  nome_posto TEXT,
  cliente_id BIGINT,
  nome_cliente TEXT,
  produto TEXT,
  preco_calculado NUMERIC,
  custo_dia NUMERIC,
  diferenca NUMERIC,
  percentual_desconto NUMERIC,
  negativado BOOLEAN,
  observacoes TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'nf', 'cotacao'
AS $$
DECLARE
  v_data_inicio DATE;
  v_data_fim DATE;
BEGIN
  -- Definir datas padrão (últimos 7 dias para ser mais rápido)
  v_data_inicio := COALESCE(p_data_inicio, CURRENT_DATE - INTERVAL '7 days');
  v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

  RETURN QUERY
  WITH transacoes_validas AS (
    -- Passo 1: Filtrar e processar apenas transações válidas (mais rápido)
    SELECT 
      t.id_item_venda_cf,
      TO_DATE(t.data_cupom, 'DD/MM/YYYY') AS data_transacao,
      t.id_empresa,
      t.id_cliente,
      t.denominacao_item,
      REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC AS preco_calculado,
      COALESCE(t.usuario_desconto_acrescimo, '') AS observacoes
    FROM nf.transações t
    WHERE 
      t.data_cupom IS NOT NULL 
      AND t.data_cupom != ''
      AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN v_data_inicio AND v_data_fim
      AND t.preco_calculado IS NOT NULL 
      AND t.preco_calculado != ''
      AND t.denominacao_item IS NOT NULL
      AND t.id_empresa IS NOT NULL
    LIMIT 5000  -- Limitar processamento inicial
  ),
  -- Passo 2: Agrupar combinações únicas de posto/produto/data
  combinacoes_unicas AS (
    SELECT DISTINCT
      tv.id_empresa,
      tv.denominacao_item,
      tv.data_transacao
    FROM transacoes_validas tv
  ),
  -- Passo 3: Buscar custos em lote (uma vez por combinação)
  custos_batch AS (
    SELECT 
      cu.id_empresa,
      cu.denominacao_item,
      cu.data_transacao,
      COALESCE(
        (SELECT custo_total 
         FROM public.get_lowest_cost_freight(
           cu.id_empresa::text,
           cu.denominacao_item,
           cu.data_transacao
         ) 
         LIMIT 1),
        0
      ) AS custo_dia
    FROM combinacoes_unicas cu
  ),
  -- Passo 4: Juntar transações com custos (JOIN eficiente)
  resultado_final AS (
    SELECT 
      tv.id_item_venda_cf,
      tv.data_transacao,
      tv.id_empresa,
      tv.id_cliente,
      tv.denominacao_item,
      tv.preco_calculado,
      tv.observacoes,
      cb.custo_dia,
      (tv.preco_calculado - cb.custo_dia) AS diferenca
    FROM transacoes_validas tv
    INNER JOIN custos_batch cb ON 
      cb.id_empresa = tv.id_empresa
      AND cb.denominacao_item = tv.denominacao_item
      AND cb.data_transacao = tv.data_transacao
    WHERE tv.preco_calculado < cb.custo_dia  -- Apenas negativados
  )
  SELECT 
    rf.id_item_venda_cf AS id_transacao,
    rf.data_transacao,
    rf.id_empresa AS posto_id,
    COALESCE(se.nome_empresa, 'Posto Desconhecido') AS nome_posto,
    rf.id_cliente AS cliente_id,
    COALESCE(c.nome, 'Cliente Desconhecido') AS nome_cliente,
    rf.denominacao_item AS produto,
    rf.preco_calculado,
    rf.custo_dia,
    rf.diferenca,
    CASE 
      WHEN rf.custo_dia > 0 THEN
        (rf.diferenca / rf.custo_dia) * 100
      ELSE 0
    END AS percentual_desconto,
    true AS negativado,
    rf.observacoes
  FROM resultado_final rf
  LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::text = rf.id_empresa::text
  LEFT JOIN public.clientes c ON c.id_cliente::text = rf.id_cliente::text
  ORDER BY rf.data_transacao DESC, rf.preco_calculado ASC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_descontos_indevidos IS 
'Busca transações negativadas ULTRA OTIMIZADA: processa até 5000 transações, agrupa custos para reduzir chamadas';

