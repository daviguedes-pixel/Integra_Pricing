# Guia de Limpeza de Dados - Sistema de Aprovações

## 📋 Tabelas que devem ser limpas

Para resetar o sistema e deixá-lo pronto para uso inicial, você precisa deletar os dados das seguintes tabelas **nesta ordem**:

### 1. **approval_history** (Histórico de Aprovações)
- Contém o histórico de todas as aprovações/rejeições
- Tem relação com `price_suggestions` (ON DELETE CASCADE)
- **Comando:** `DELETE FROM public.approval_history;`

### 2. **price_history** (Histórico de Preços)
- Contém o histórico de mudanças de preços
- Tem relação com `price_suggestions` (ON DELETE SET NULL)
- **Comando:** `DELETE FROM public.price_history;`

### 3. **referencias** (Referências de Preços)
- Contém as referências de preços cadastradas
- Pode ter relação com `price_suggestions`
- **Comando:** `DELETE FROM public.referencias;`

### 4. **price_suggestions** (Sugestões de Preço) ⭐ **PRINCIPAL**
- Tabela principal com todas as sugestões de preço
- Esta é a tabela que aparece no site
- **Comando:** `DELETE FROM public.price_suggestions;`

### 5. **competitor_research** (Pesquisa de Concorrentes)
- Contém pesquisas de preços de concorrentes
- Independente, mas relacionada ao contexto
- **Comando:** `DELETE FROM public.competitor_research;`

### 6. **notifications** (Notificações) - Se existir
- Contém notificações do sistema
- **Comando:** `DELETE FROM public.notifications;`

## 🚀 Como executar a limpeza

### Opção 1: Usar o script SQL criado (Recomendado)

Execute o arquivo de migração criado:
```sql
-- Arquivo: supabase/migrations/20250207000000_clean_approvals_and_references.sql
```

### Opção 2: Executar manualmente no Supabase

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute os comandos nesta ordem:

```sql
nao
```

## ⚠️ Por que ainda aparecem dados no site?

Se você deletou os dados mas ainda aparecem no site, pode ser por:

1. **Cache do navegador** - Limpe o cache (Ctrl+Shift+Delete)
2. **Cache do localStorage** - O código usa cache local (5 minutos)
   - Abra o DevTools (F12)
   - Vá em Application > Local Storage
   - Delete as chaves que começam com `approvals_` ou `suggestions_`
3. **Dados em outras tabelas** - Verifique se deletou todas as tabelas listadas acima
4. **Cache do Supabase** - Pode levar alguns segundos para atualizar

## 🔍 Verificar se a limpeza funcionou

Execute estas queries para verificar:

```sql
-- Verificar quantos registros restam em cada tabela
SELECT 'approval_history' as tabela, COUNT(*) as total FROM public.approval_history
UNION ALL
SELECT 'price_history', COUNT(*) FROM public.price_history
UNION ALL
SELECT 'referencias', COUNT(*) FROM public.referencias
UNION ALL
SELECT 'price_suggestions', COUNT(*) FROM public.price_suggestions
UNION ALL
SELECT 'competitor_research', COUNT(*) FROM public.competitor_research;
```

Todos devem retornar `0`.

## 📝 Tabelas que NÃO devem ser deletadas

⚠️ **NÃO delete** estas tabelas (são dados de configuração):

- `stations` - Postos de combustível
- `clients` - Clientes
- `payment_methods` - Métodos de pagamento
- `user_profiles` - Perfis de usuários
- `tipos_pagamento` - Tipos de pagamento (se existir)
- `clientes` - Clientes (se existir)
- `sis_empresa` - Empresas (se existir)

Essas são tabelas de referência/configuração e devem ser mantidas.

## ✅ Após a limpeza

1. Limpe o cache do navegador
2. Recarregue a página (Ctrl+F5)
3. Verifique se não aparecem mais dados antigos
4. O sistema estará pronto para uso inicial







