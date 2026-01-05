-- =====================================================
-- FUNÇÃO: get_sis_empresa_by_ids
-- Execute esta função no SQL Editor do Supabase
-- Use a mesma sintaxe que get_sis_empresa_stations (que funciona)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_sis_empresa_by_ids(
  p_ids bigint[]
)
RETURNS TABLE(
  id_empresa bigint,
  nome_empresa text,
  cnpj_cpf text,
  latitude numeric,
  longitude numeric,
  bandeira text,
  rede text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $$
  SELECT 
    se.id_empresa,
    se.nome_empresa,
    se.cnpj_cpf,
    se.latitude,
    se.longitude,
    se.bandeira,
    se.rede
  FROM cotacao.sis_empresa se
  WHERE se.id_empresa = ANY(p_ids)
  ORDER BY se.nome_empresa;
$$;

