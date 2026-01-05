# Aplicar Migrations para Funções RPC de sis_empresa

## Problema
As funções RPC `get_sis_empresa_by_ids`, `get_sis_empresa_id_by_name` e a atualização de `get_sis_empresa_stations` precisam ser aplicadas no banco de dados.

## ⚠️ IMPORTANTE: Problema com Delimitadores $$

O SQL Editor do Supabase pode ter problemas com delimitadores `$$`. Use uma das opções abaixo:

## Opção 1: Via Supabase Dashboard (Recomendado - Mais Rápido)

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **SQL Editor** (menu lateral)
4. **Execute cada função SEPARADAMENTE** (uma por vez):

### ⚡ SOLUÇÃO RÁPIDA: Use o arquivo `scripts/APLICAR_FUNCOES_RPC_SIS_EMPRESA_SEPARADAS.sql`

Execute cada função individualmente copiando e colando uma por vez no SQL Editor.

### Migration 1: get_sis_empresa_by_ids

```sql
-- Function to get sis_empresa data by list of id_empresa
-- This function allows querying sis_empresa from the cotacao schema via RPC
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
```

### Migration 2: get_sis_empresa_id_by_name

```sql
-- Function to get id_empresa from sis_empresa by nome_empresa (case-insensitive search)
-- This function allows querying sis_empresa from the cotacao schema via RPC
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
```

### Migration 3: Atualizar get_sis_empresa_stations (adicionar municipio e uf)

```sql
-- Adicionar municipio e uf à função get_sis_empresa_stations
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
```

## Opção 2: Via Supabase CLI

Se você tem o Supabase CLI configurado:

```bash
# Aplicar todas as migrations pendentes
supabase db push

# Ou aplicar migrations específicas
supabase migration up
```

## Verificação

Após aplicar as migrations, verifique se as funções foram criadas:

```sql
-- Verificar se as funções existem
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_sis_empresa_by_ids',
    'get_sis_empresa_id_by_name',
    'get_sis_empresa_stations'
  );
```

Você deve ver as 3 funções listadas.

## Teste Rápido

Teste a função `get_sis_empresa_by_ids`:

```sql
-- Teste com alguns IDs
SELECT * FROM public.get_sis_empresa_by_ids(ARRAY[1170823392, 840337350]::bigint[]);
```

Se retornar dados, está funcionando! ✅

