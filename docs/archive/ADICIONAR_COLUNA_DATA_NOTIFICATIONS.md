# Adicionar Coluna 'data' à Tabela Notifications

## Problema
A tabela `notifications` não tem a coluna `data`, que é necessária para armazenar informações adicionais como `approved_by`, `rejected_by`, etc.

## Solução
Execute a migration `20250206000000_add_data_column_to_notifications.sql` no Supabase Dashboard.

## Como Aplicar

### Opção 1: Via Supabase Dashboard (Recomendado)
1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Clique em **New Query**
4. Cole o conteúdo do arquivo `supabase/migrations/20250206000000_add_data_column_to_notifications.sql`
5. Clique em **Run**

### Opção 2: Via Supabase CLI
```bash
supabase db push
```

## Verificação
Após aplicar a migration, verifique se a coluna foi adicionada:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'data';
```

Deve retornar:
```
column_name | data_type
------------|----------
data        | jsonb
```

## O que a Migration Faz
- Adiciona a coluna `data` (tipo JSONB) à tabela `notifications` se ela não existir
- Adiciona um comentário explicando o propósito da coluna
- É segura para executar múltiplas vezes (usa `IF NOT EXISTS`)

