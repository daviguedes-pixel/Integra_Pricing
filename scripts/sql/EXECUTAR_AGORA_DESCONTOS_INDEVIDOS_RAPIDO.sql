-- Script OTIMIZADO e RÁPIDO para mais de 1000 transações
-- Usa processamento em lote e otimizações para evitar timeout
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a função se já existir
DROP FUNCTION IF EXISTS public.get_descontos_indevidos(DATE, DATE);

-- Criar a função otimizada com processamento eficiente
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
  -- Definir datas padrão se não fornecidas (últimos 7 dias para ser mais rápido)
  v_data_inicio := COALESCE(p_data_inicio, CURRENT_DATE - INTERVAL '7 days');
  v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

  RETURN QUERY
  WITH transacoes_filtradas AS (
    -- Primeiro: filtrar apenas transações válidas e com preço calculado
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
  ),
  -- Agrupar por posto/produto/data para reduzir chamadas à função
  transacoes_agrupadas AS (
    SELECT DISTINCT
      tf.id_empresa,
      tf.denominacao_item,
      tf.data_transacao
    FROM transacoes_filtradas tf
  ),
  -- Buscar custos uma vez por combinação posto/produto/data
  custos_cache AS (
    SELECT 
      ta.id_empresa,
      ta.denominacao_item,
      ta.data_transacao,
      COALESCE(cf.custo_total, 0) AS custo_dia
    FROM transacoes_agrupadas ta
    CROSS JOIN LATERAL (
      SELECT custo_total
      FROM public.get_lowest_cost_freight(
        ta.id_empresa::text,
        ta.denominacao_item,
        ta.data_transacao
      )
      LIMIT 1
    ) cf
  ),
  -- Juntar transações com custos
  transacoes_com_custo AS (
    SELECT 
      tf.id_item_venda_cf,
      tf.data_transacao,
      tf.id_empresa,
      tf.id_cliente,
      tf.denominacao_item,
      tf.preco_calculado,
      tf.observacoes,
      COALESCE(cc.custo_dia, 0) AS custo_dia
    FROM transacoes_filtradas tf
    LEFT JOIN custos_cache cc ON 
      cc.id_empresa = tf.id_empresa
      AND cc.denominacao_item = tf.denominacao_item
      AND cc.data_transacao = tf.data_transacao
    WHERE tf.preco_calculado < COALESCE(cc.custo_dia, 999999)  -- Filtrar apenas negativados
  )
  SELECT 
    tcc.id_item_venda_cf AS id_transacao,
    tcc.data_transacao,
    tcc.id_empresa AS posto_id,
    COALESCE(se.nome_empresa, 'Posto Desconhecido') AS nome_posto,
    tcc.id_cliente AS cliente_id,
    COALESCE(c.nome, 'Cliente Desconhecido') AS nome_cliente,
    tcc.denominacao_item AS produto,
    tcc.preco_calculado,
    tcc.custo_dia,
    (tcc.preco_calculado - tcc.custo_dia) AS diferenca,
    CASE 
      WHEN tcc.custo_dia > 0 THEN
        ((tcc.preco_calculado - tcc.custo_dia) / tcc.custo_dia) * 100
      ELSE 0
    END AS percentual_desconto,
    true AS negativado,
    tcc.observacoes
  FROM transacoes_com_custo tcc
  LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::text = tcc.id_empresa::text
  LEFT JOIN public.clientes c ON c.id_cliente::text = tcc.id_cliente::text
  WHERE tcc.preco_calculado < tcc.custo_dia  -- Garantir que é negativado
  ORDER BY tcc.data_transacao DESC, tcc.preco_calculado ASC;
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_descontos_indevidos IS 
'Busca transações negativadas otimizada: agrupa por posto/produto/data para reduzir chamadas à função de custo';

