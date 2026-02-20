-- Function to get sis_empresa data by list of id_empresa
-- This function allows querying sis_empresa from the cotacao schema via RPC
-- id_empresa na tabela é text/varchar, então aceitamos text[]
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
     OR se.cnpj_cpf::text = ANY(p_ids)
     OR se.nome_empresa::text = ANY(p_ids)
  ORDER BY se.nome_empresa;
$$;

