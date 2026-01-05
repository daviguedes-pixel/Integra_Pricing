-- Função RPC otimizada para buscar contatos do schema cotacao
-- Versão otimizada para melhor performance

DROP FUNCTION IF EXISTS public.get_contatos();

CREATE OR REPLACE FUNCTION public.get_contatos()
RETURNS TABLE (
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
    -- UF: usar SIG_UF diretamente
    COALESCE(c."SIG_UF", '')::text as uf,
    
    -- Estado: converter UF para nome do estado
    (CASE c."SIG_UF"
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
    END)::text as estado,
    
    -- Cidade: usar NOM_LOCALIDADE
    COALESCE(c."NOM_LOCALIDADE", '')::text as cidade,
    
    -- Base: vazio por padrão
    ''::text as base,
    
    -- Distribuidora: usar NOM_RAZAO_SOCIAL
    COALESCE(c."NOM_RAZAO_SOCIAL", '')::text as distribuidora,
    
    -- Pego: sempre false
    false::boolean as pego,
    
    -- Status: sempre faltante
    'faltante'::text as status,
    
    -- Data: usar DAT_PUBLICACAO (converter de texto DD/MM/YYYY para timestamp)
    CASE 
      WHEN c."DAT_PUBLICACAO" IS NULL OR c."DAT_PUBLICACAO"::text = '' THEN NULL::timestamp with time zone
      WHEN c."DAT_PUBLICACAO"::text ~ '^\d{2}/\d{2}/\d{4}' THEN 
        -- Converter de DD/MM/YYYY para timestamp
        TO_TIMESTAMP(c."DAT_PUBLICACAO"::text, 'DD/MM/YYYY')::timestamp with time zone
      ELSE 
        -- Tentar converter como timestamp padrão ou retornar NULL
        NULL::timestamp with time zone
    END as data_contato,
    
    -- Responsável: vazio por padrão
    ''::text as responsavel,
    
    -- Região: calcular baseado na UF
    (CASE c."SIG_UF"
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
    END)::text as regiao
  FROM cotacao."Contatos" c;
END;
$$;

-- Dar permissões
GRANT EXECUTE ON FUNCTION public.get_contatos() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_contatos() TO anon;
GRANT EXECUTE ON FUNCTION public.get_contatos() TO service_role;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_contatos_sig_uf ON cotacao."Contatos"("SIG_UF");

-- Forçar refresh do cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- Comentário
COMMENT ON FUNCTION public.get_contatos() IS 'Retorna todos os contatos do schema cotacao mapeando as colunas reais (NOM_RAZAO_SOCIAL, NOM_LOCALIDADE, SIG_UF, DAT_PUBLICACAO) para o formato esperado pelo frontend. Versão otimizada para performance.';
