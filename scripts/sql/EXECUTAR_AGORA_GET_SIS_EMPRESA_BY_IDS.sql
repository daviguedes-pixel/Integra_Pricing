-- =====================================================
-- EXECUTE ESTE SCRIPT AGORA NO SQL EDITOR
-- id_empresa na tabela é text/varchar, não bigint
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_sis_empresa_by_ids(
  p_ids text[]
)
RETURNS TABLE(
  id_empresa text,
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
    se.id_empresa::text,
    se.nome_empresa,
    se.cnpj_cpf,
    se.latitude,
    se.longitude,
    se.bandeira,
    se.rede
  FROM cotacao.sis_empresa se
  WHERE se.id_empresa::text = ANY(p_ids)
  ORDER BY se.nome_empresa;
$$;

