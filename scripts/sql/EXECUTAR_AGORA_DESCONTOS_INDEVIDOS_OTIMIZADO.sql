-- Script OTIMIZADO para aplicar a função get_descontos_indevidos
-- Versão com melhor performance para evitar timeout
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a função se já existir
DROP FUNCTION IF EXISTS public.get_descontos_indevidos(DATE, DATE);

-- Criar a função otimizada
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
  -- Definir datas padrão se não fornecidas
  v_data_inicio := COALESCE(p_data_inicio, CURRENT_DATE - INTERVAL '30 days');
  v_data_fim := COALESCE(p_data_fim, CURRENT_DATE);

  RETURN QUERY
  WITH transacoes_processadas AS (
    SELECT 
      t.id_item_venda_cf AS id_transacao,
      CASE 
        WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
          TO_DATE(t.data_cupom, 'DD/MM/YYYY')
        ELSE CURRENT_DATE
      END AS data_transacao,
      t.id_empresa AS posto_id,
      t.id_cliente AS cliente_id,
      COALESCE(t.denominacao_item, 'Produto Desconhecido') AS produto,
      CASE 
        WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
          REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
        ELSE 0
      END AS preco_calculado,
      COALESCE(t.usuario_desconto_acrescimo, '') AS observacoes
    FROM nf.transações t
    WHERE 
      (t.data_cupom IS NOT NULL AND t.data_cupom != '' AND TO_DATE(t.data_cupom, 'DD/MM/YYYY') BETWEEN v_data_inicio AND v_data_fim)
      OR (t.data_cupom IS NULL OR t.data_cupom = '')
  ),
  custos_calculados AS (
    SELECT DISTINCT ON (tp.posto_id, tp.produto, tp.data_transacao)
      tp.id_transacao,
      tp.data_transacao,
      tp.posto_id,
      tp.cliente_id,
      tp.produto,
      tp.preco_calculado,
      tp.observacoes,
      COALESCE(cf.custo_total, 0) AS custo_dia
    FROM transacoes_processadas tp
    LEFT JOIN LATERAL (
      SELECT custo_total
      FROM public.get_lowest_cost_freight(
        tp.posto_id::text,
        tp.produto,
        tp.data_transacao
      )
      LIMIT 1
    ) cf ON true
    WHERE tp.preco_calculado > 0  -- Apenas transações com preço válido
  )
  SELECT 
    cc.id_transacao,
    cc.data_transacao,
    cc.posto_id,
    COALESCE(se.nome_empresa, 'Posto Desconhecido') AS nome_posto,
    cc.cliente_id,
    COALESCE(c.nome, 'Cliente Desconhecido') AS nome_cliente,
    cc.produto,
    cc.preco_calculado,
    cc.custo_dia,
    (cc.preco_calculado - cc.custo_dia) AS diferenca,
    CASE 
      WHEN cc.custo_dia > 0 THEN
        ((cc.preco_calculado - cc.custo_dia) / cc.custo_dia) * 100
      ELSE 0
    END AS percentual_desconto,
    (cc.preco_calculado < cc.custo_dia) AS negativado,
    cc.observacoes
  FROM custos_calculados cc
  LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::text = cc.posto_id::text
  LEFT JOIN public.clientes c ON c.id_cliente::text = cc.cliente_id::text
  WHERE cc.preco_calculado < cc.custo_dia  -- Apenas negativados
  ORDER BY cc.data_transacao DESC, cc.preco_calculado ASC
  LIMIT 1000;  -- Limitar a 1000 resultados para evitar timeout
END;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_descontos_indevidos IS 
'Busca transações da tabela nf.transações onde o preço calculado é menor que o custo do dia (otimizado com limite de 1000 resultados)';

