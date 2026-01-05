-- =====================================================
-- SCRIPT SEPARADO: Execute CADA função individualmente
-- Copie e cole UMA função por vez no SQL Editor
-- =====================================================

-- =====================================================
-- FUNÇÃO 1: get_sis_empresa_by_ids
-- Copie e execute APENAS esta função primeiro
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
AS $BODY$
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
$BODY$;

-- =====================================================
-- FUNÇÃO 2: get_sis_empresa_id_by_name
-- Copie e execute esta função DEPOIS da primeira
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_sis_empresa_id_by_name(
  p_nome_empresa text
)
RETURNS TABLE(
  id_empresa bigint,
  nome_empresa text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $BODY$
  SELECT 
    se.id_empresa,
    se.nome_empresa
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa ILIKE '%' || p_nome_empresa || '%'
  ORDER BY se.nome_empresa
  LIMIT 1;
$BODY$;

-- =====================================================
-- FUNÇÃO 3: Atualizar get_sis_empresa_stations
-- Copie e execute esta função por ÚLTIMO
-- =====================================================
DROP FUNCTION IF EXISTS public.get_sis_empresa_stations();

CREATE FUNCTION public.get_sis_empresa_stations()
RETURNS TABLE(
  nome_empresa text,
  cnpj_cpf text,
  id_empresa text,
  latitude numeric,
  longitude numeric,
  bandeira text,
  rede text,
  municipio text,
  uf text,
  registro_ativo text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $BODY$
  SELECT DISTINCT ON (COALESCE(se.cnpj_cpf, se.nome_empresa))
    se.nome_empresa,
    se.cnpj_cpf,
    se.id_empresa::text,
    se.latitude,
    se.longitude,
    se.bandeira,
    se.rede,
    se.municipio,
    se.uf,
    COALESCE(se.registro_ativo::text, 'S') AS registro_ativo
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa IS NOT NULL AND se.nome_empresa <> ''
  ORDER BY COALESCE(se.cnpj_cpf, se.nome_empresa), se.nome_empresa;
$BODY$;

