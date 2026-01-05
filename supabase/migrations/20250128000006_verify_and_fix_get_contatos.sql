-- Script para verificar e garantir que a função get_contatos existe e está correta

-- Primeiro, verificar se a função existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_contatos'
  ) THEN
    RAISE NOTICE 'Função get_contatos não encontrada. Criando...';
  ELSE
    RAISE NOTICE 'Função get_contatos encontrada. Recriando para garantir que está atualizada...';
  END IF;
END $$;

-- Recriar a função (isso garante que está atualizada)
CREATE OR REPLACE FUNCTION public.get_contatos()
RETURNS TABLE (
  id text,
  uf text,
  estado text,
  cidade text,
  base text,
  distribuidora text,
  pego boolean,
  status text,
  data_contato timestamp with time zone,
  responsavel text,
  regiao text
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, cotacao
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c."NUM_CNPJ"::text, c."NUM_C"::text, c.id::text, '') as id,
    COALESCE(c."SIG_UF", '') as uf,
    CASE c."SIG_UF"
      WHEN 'AC' THEN 'Acre'
      WHEN 'AL' THEN 'Alagoas'
      WHEN 'AP' THEN 'Amapá'
      WHEN 'AM' THEN 'Amazonas'
      WHEN 'BA' THEN 'Bahia'
      WHEN 'CE' THEN 'Ceará'
      WHEN 'DF' THEN 'Distrito Federal'
      WHEN 'ES' THEN 'Espírito Santo'
      WHEN 'GO' THEN 'Goiás'
      WHEN 'MA' THEN 'Maranhão'
      WHEN 'MT' THEN 'Mato Grosso'
      WHEN 'MS' THEN 'Mato Grosso do Sul'
      WHEN 'MG' THEN 'Minas Gerais'
      WHEN 'PA' THEN 'Pará'
      WHEN 'PB' THEN 'Paraíba'
      WHEN 'PR' THEN 'Paraná'
      WHEN 'PE' THEN 'Pernambuco'
      WHEN 'PI' THEN 'Piauí'
      WHEN 'RJ' THEN 'Rio de Janeiro'
      WHEN 'RN' THEN 'Rio Grande do Norte'
      WHEN 'RS' THEN 'Rio Grande do Sul'
      WHEN 'RO' THEN 'Rondônia'
      WHEN 'RR' THEN 'Roraima'
      WHEN 'SC' THEN 'Santa Catarina'
      WHEN 'SP' THEN 'São Paulo'
      WHEN 'SE' THEN 'Sergipe'
      WHEN 'TO' THEN 'Tocantins'
      ELSE ''
    END as estado,
    COALESCE(c."NOM_LOCALIDADE", '') as cidade,
    '' as base,
    COALESCE(c."NOM_RAZAO_SOCIAL", '') as distribuidora,
    false as pego,
    'faltante' as status,
    c."DAT_PUBLICACAO" as data_contato,
    '' as responsavel,
    CASE c."SIG_UF"
      WHEN 'AC' THEN 'Norte'
      WHEN 'AM' THEN 'Norte'
      WHEN 'AP' THEN 'Norte'
      WHEN 'PA' THEN 'Norte'
      WHEN 'RO' THEN 'Norte'
      WHEN 'RR' THEN 'Norte'
      WHEN 'TO' THEN 'Norte'
      WHEN 'AL' THEN 'Nordeste'
      WHEN 'BA' THEN 'Nordeste'
      WHEN 'CE' THEN 'Nordeste'
      WHEN 'MA' THEN 'Nordeste'
      WHEN 'PB' THEN 'Nordeste'
      WHEN 'PE' THEN 'Nordeste'
      WHEN 'PI' THEN 'Nordeste'
      WHEN 'RN' THEN 'Nordeste'
      WHEN 'SE' THEN 'Nordeste'
      WHEN 'ES' THEN 'Sudeste'
      WHEN 'MG' THEN 'Sudeste'
      WHEN 'RJ' THEN 'Sudeste'
      WHEN 'SP' THEN 'Sudeste'
      WHEN 'PR' THEN 'Sul'
      WHEN 'RS' THEN 'Sul'
      WHEN 'SC' THEN 'Sul'
      WHEN 'DF' THEN 'Centro-Oeste'
      WHEN 'GO' THEN 'Centro-Oeste'
      WHEN 'MT' THEN 'Centro-Oeste'
      WHEN 'MS' THEN 'Centro-Oeste'
      ELSE 'Outros'
    END as regiao
  FROM cotacao."Contatos" c;
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION public.get_contatos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contatos() TO anon;
GRANT EXECUTE ON FUNCTION public.get_contatos() TO service_role;

-- Criar índice se não existir
CREATE INDEX IF NOT EXISTS idx_contatos_sig_uf ON cotacao."Contatos"("SIG_UF");

-- Verificar se a função foi criada com sucesso
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'get_contatos'
  ) THEN
    RAISE NOTICE '✅ Função get_contatos criada/atualizada com sucesso!';
  ELSE
    RAISE EXCEPTION '❌ Erro: Função get_contatos não foi criada';
  END IF;
END $$;

