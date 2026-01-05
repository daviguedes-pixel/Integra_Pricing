-- Function to get payment methods for a specific station
CREATE OR REPLACE FUNCTION public.get_payment_methods_for_station(
  p_station_id text
)
RETURNS TABLE(
  id_posto text,
  cartao text,
  taxa numeric,
  tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cotacao'
AS $$
DECLARE
  v_id_empresa BIGINT;
BEGIN
  -- Buscar id_empresa do sis_empresa usando CNPJ ou nome
  SELECT se.id_empresa INTO v_id_empresa
  FROM cotacao.sis_empresa se
  WHERE se.cnpj_cpf = p_station_id
     OR se.nome_empresa = p_station_id
  LIMIT 1;

  -- Se encontrou id_empresa, buscar tipos de pagamento
  IF v_id_empresa IS NOT NULL THEN
    RETURN QUERY
    SELECT 
      tp."ID_POSTO"::text AS id_posto,
      tp."CARTAO"::text AS cartao,
      tp."TAXA"::numeric AS taxa,
      tp."TIPO"::text AS tipo
    FROM public.tipos_pagamento tp
    WHERE tp."ID_POSTO" = v_id_empresa::text
    ORDER BY tp."CARTAO";
  END IF;

  RETURN;
END;
$$;















