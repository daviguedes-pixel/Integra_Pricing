-- =====================================================
-- SCRIPT COMPLETO: Aplicar Funções RPC para sis_empresa
-- Execute este script no SQL Editor do Supabase Dashboard
-- =====================================================

-- Migration 1: get_sis_empresa_by_ids
-- Function to get sis_empresa data by list of id_empresa
CREATE OR REPLACE FUNCTION public.get_sis_empresa_by_ids(
  p_ids bigint[]
)
RETURNS TABLE(
  id_empresa bigint,
  nome_empresa text,
  razao_social text,
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
    se.razao_social,
    se.cnpj_cpf,
    se.latitude,
    se.longitude,
    se.bandeira,
    se.rede
  FROM cotacao.sis_empresa se
  WHERE se.id_empresa = ANY(p_ids)
  ORDER BY se.nome_empresa;
$$;

-- Migration 2: get_sis_empresa_id_by_name
-- Function to get id_empresa from sis_empresa by nome_empresa (case-insensitive search)
CREATE OR REPLACE FUNCTION public.get_sis_empresa_id_by_name(
  p_nome_empresa text
)
RETURNS TABLE(
  id_empresa bigint,
  nome_empresa text,
  razao_social text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public', 'cotacao'
AS $$
  SELECT 
    se.id_empresa,
    se.nome_empresa,
    se.razao_social
  FROM cotacao.sis_empresa se
  WHERE se.nome_empresa ILIKE '%' || p_nome_empresa || '%'
  ORDER BY se.nome_empresa
  LIMIT 1;
$$;

-- Migration 3: Atualizar get_sis_empresa_stations (adicionar municipio e uf)
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
AS $$
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
$$;

-- =====================================================
-- VERIFICAÇÃO: Verificar se as funções foram criadas
-- =====================================================
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_sis_empresa_by_ids',
    'get_sis_empresa_id_by_name',
    'get_sis_empresa_stations'
  )
ORDER BY routine_name;

-- =====================================================
-- TESTE: Testar a função get_sis_empresa_by_ids
-- =====================================================
-- Descomente a linha abaixo para testar (substitua os IDs pelos seus IDs reais)
-- SELECT * FROM public.get_sis_empresa_by_ids(ARRAY[1170823392, 840337350]::bigint[]);

