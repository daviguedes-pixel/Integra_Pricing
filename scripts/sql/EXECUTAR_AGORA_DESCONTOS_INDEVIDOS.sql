-- Script simplificado para aplicar a função get_descontos_indevidos
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a função se já existir
DROP FUNCTION IF EXISTS public.get_descontos_indevidos(DATE, DATE);

-- Criar a função
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'nf', 'cotacao'
AS $$
  SELECT 
    t.id AS id_transacao,
    COALESCE(t.data, t.data_transacao, CURRENT_DATE)::DATE AS data_transacao,
    COALESCE(t.id_posto, t.posto, t.id_empresa) AS posto_id,
    COALESCE(se.nome_empresa, 'Posto Desconhecido') AS nome_posto,
    COALESCE(t.id_cliente, t.cliente, t.cliente_id) AS cliente_id,
    COALESCE(c.nome, 'Cliente Desconhecido') AS nome_cliente,
    COALESCE(t.produto, t.tipo_produto, 'Produto Desconhecido') AS produto,
    COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) AS preco_calculado,
    COALESCE(cg.custo_dia, 0) AS custo_dia,
    (COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) - COALESCE(cg.custo_dia, 0)) AS diferenca,
    CASE 
      WHEN COALESCE(cg.custo_dia, 0) > 0 THEN
        ((COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) - COALESCE(cg.custo_dia, 0)) / COALESCE(cg.custo_dia, 0)) * 100
      ELSE 0
    END AS percentual_desconto,
    (COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) < COALESCE(cg.custo_dia, 0)) AS negativado,
    COALESCE(t.observacoes, t.observacao, '') AS observacoes
  FROM nf.transações t
  LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::text = COALESCE(t.id_posto, t.posto, t.id_empresa)::text
  LEFT JOIN public.clientes c ON c.id_cliente::text = COALESCE(t.id_cliente, t.cliente, t.cliente_id)::text
  LEFT JOIN LATERAL (
    SELECT 
      CASE 
        WHEN cgc.custo_dia IS NOT NULL THEN cgc.custo_dia
        WHEN cgc.custo_compra IS NOT NULL AND cgc.frete IS NOT NULL THEN (cgc.custo_compra + cgc.frete)
        WHEN cgc.custo_compra IS NOT NULL THEN cgc.custo_compra
        ELSE 0
      END AS custo_dia
    FROM cotacao.cotacao_geral_combustivel cgc
    WHERE cgc.id_empresa::text = COALESCE(t.id_posto, t.posto, t.id_empresa)::text
      AND cgc.produto = COALESCE(t.produto, t.tipo_produto)
      AND cgc.data_cotacao::DATE = COALESCE(t.data, t.data_transacao, CURRENT_DATE)::DATE
    ORDER BY cgc.data_cotacao DESC
    LIMIT 1
  ) cg ON true
  WHERE 
    (p_data_inicio IS NULL OR COALESCE(t.data, t.data_transacao, CURRENT_DATE)::DATE >= p_data_inicio)
    AND (p_data_fim IS NULL OR COALESCE(t.data, t.data_transacao, CURRENT_DATE)::DATE <= p_data_fim)
    AND COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) < COALESCE(cg.custo_dia, 0)
  ORDER BY COALESCE(t.data, t.data_transacao, CURRENT_DATE) DESC, COALESCE(t.preco_calculado, t.preco, t.valor_calculado, 0) ASC;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_descontos_indevidos IS 
'Busca transações da tabela nf.transações onde o preço calculado é menor que o custo do dia';

