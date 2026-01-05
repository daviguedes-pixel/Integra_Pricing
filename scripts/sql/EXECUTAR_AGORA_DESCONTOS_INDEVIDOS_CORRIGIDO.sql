-- Script CORRIGIDO com os nomes corretos das colunas da tabela nf.transações
-- Execute este script no Supabase SQL Editor

-- Primeiro, remover a função se já existir
DROP FUNCTION IF EXISTS public.get_descontos_indevidos(DATE, DATE);

-- Criar a função com os nomes corretos das colunas
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
    t.id_item_venda_cf AS id_transacao,
    CASE 
      WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
        TO_DATE(t.data_cupom, 'DD/MM/YYYY')
      ELSE CURRENT_DATE
    END AS data_transacao,
    t.id_empresa AS posto_id,
    COALESCE(se.nome_empresa, t.nome_empresa, 'Posto Desconhecido') AS nome_posto,
    t.id_cliente AS cliente_id,
    COALESCE(c.nome, t.nome_cliente, 'Cliente Desconhecido') AS nome_cliente,
    COALESCE(t.denominacao_item, 'Produto Desconhecido') AS produto,
    CASE 
      WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
        REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
      ELSE 0
    END AS preco_calculado,
    COALESCE(cg.custo_dia, 0) AS custo_dia,
    (CASE 
      WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
        REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
      ELSE 0
    END - COALESCE(cg.custo_dia, 0)) AS diferenca,
    CASE 
      WHEN COALESCE(cg.custo_dia, 0) > 0 THEN
        ((CASE 
          WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
            REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
          ELSE 0
        END - COALESCE(cg.custo_dia, 0)) / COALESCE(cg.custo_dia, 0)) * 100
      ELSE 0
    END AS percentual_desconto,
    (CASE 
      WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
        REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
      ELSE 0
    END < COALESCE(cg.custo_dia, 0)) AS negativado,
    COALESCE(t.usuario_desconto_acrescimo, '') AS observacoes
  FROM nf.transações t
  LEFT JOIN cotacao.sis_empresa se ON se.id_empresa::text = t.id_empresa::text
  LEFT JOIN public.clientes c ON c.id_cliente::text = t.id_cliente::text
  LEFT JOIN LATERAL (
    SELECT COALESCE(cf.custo_total, 0) AS custo_dia
    FROM public.get_lowest_cost_freight(
      t.id_empresa::text,
      t.denominacao_item,
      CASE 
        WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
          TO_DATE(t.data_cupom, 'DD/MM/YYYY')
        ELSE CURRENT_DATE
      END
    ) cf
    LIMIT 1
  ) cg ON true
  WHERE 
    (p_data_inicio IS NULL OR CASE 
      WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
        TO_DATE(t.data_cupom, 'DD/MM/YYYY')
      ELSE CURRENT_DATE
    END >= p_data_inicio)
    AND (p_data_fim IS NULL OR CASE 
      WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
        TO_DATE(t.data_cupom, 'DD/MM/YYYY')
      ELSE CURRENT_DATE
    END <= p_data_fim)
    AND CASE 
      WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
        REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
      ELSE 0
    END < COALESCE(cg.custo_dia, 0)
  ORDER BY CASE 
      WHEN t.data_cupom IS NOT NULL AND t.data_cupom != '' THEN
        TO_DATE(t.data_cupom, 'DD/MM/YYYY')
      ELSE CURRENT_DATE
    END DESC, 
    CASE 
      WHEN t.preco_calculado IS NOT NULL AND t.preco_calculado != '' THEN
        REPLACE(REPLACE(t.preco_calculado, '.', ''), ',', '.')::NUMERIC
      ELSE 0
    END ASC;
$$;

-- Comentário
COMMENT ON FUNCTION public.get_descontos_indevidos IS 
'Busca transações da tabela nf.transações onde o preço calculado é menor que o custo do dia';

