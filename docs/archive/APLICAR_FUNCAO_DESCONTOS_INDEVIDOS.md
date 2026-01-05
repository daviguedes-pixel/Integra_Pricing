# 📋 Como Aplicar a Função get_descontos_indevidos

## ⚠️ Erro: "Could not find the function public.get_descontos_indevidos"

Este erro ocorre quando a função RPC ainda não foi criada no banco de dados.

## ✅ Solução Rápida

### Opção 1: Executar o Script SQL (Recomendado)

1. Acesse o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Abra o arquivo `scripts/EXECUTAR_AGORA_DESCONTOS_INDEVIDOS.sql`
4. **Copie todo o conteúdo** do arquivo
5. **Cole no SQL Editor** do Supabase
6. Clique em **Run** ou pressione `Ctrl+Enter`

### Opção 2: Executar Migration

Se você estiver usando migrations do Supabase CLI:

```bash
supabase db push
```

Ou execute a migration manualmente:
- Arquivo: `supabase/migrations/20250208000003_get_descontos_indevidos.sql`

## 🔍 Verificar se a Função Foi Criada

Após executar o script, verifique se a função foi criada:

```sql
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'get_descontos_indevidos';
```

Se a função aparecer, ela foi criada com sucesso!

## 🔄 Limpar Cache do PostgREST

Se a função foi criada mas ainda aparece o erro, pode ser cache do PostgREST:

1. No Supabase Dashboard, vá em **Settings** > **API**
2. Clique em **Restart PostgREST** (se disponível)
3. Ou aguarde alguns minutos para o cache atualizar automaticamente

## 📝 Estrutura da Função

A função `get_descontos_indevidos` recebe:
- `p_data_inicio` (DATE, opcional): Data inicial do período
- `p_data_fim` (DATE, opcional): Data final do período

E retorna transações da tabela `nf.transações` onde:
- `preco_calculado < custo_dia` (negativadas)

## 🧪 Testar a Função

Após criar a função, teste diretamente no SQL Editor:

```sql
-- Testar sem parâmetros (últimos 30 dias)
SELECT * FROM public.get_descontos_indevidos();

-- Testar com período específico
SELECT * FROM public.get_descontos_indevidos(
  '2025-01-01'::DATE,
  '2025-01-31'::DATE
);
```

## ❌ Problemas Comuns

### Erro: "relation nf.transações does not exist"
- Verifique se a tabela `nf.transações` existe
- Verifique se o schema `nf` está acessível

### Erro: "relation cotacao.cotacao_geral_combustivel does not exist"
- Verifique se a tabela `cotacao.cotacao_geral_combustivel` existe
- A função usa `SET search_path` para acessar esses schemas

### Erro: "permission denied"
- A função usa `SECURITY DEFINER`, então deve ter permissões adequadas
- Verifique se o usuário tem acesso aos schemas `nf` e `cotacao`

