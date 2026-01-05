# 🔍 Como Descobrir os Nomes das Colunas da Tabela nf.transações

## ⚠️ Erro: "column t.posto_id does not exist"

Este erro ocorre porque os nomes das colunas na tabela `nf.transações` são diferentes do que esperávamos.

## ✅ Solução: Verificar a Estrutura da Tabela

### Passo 1: Executar Script de Verificação

1. Acesse o **Supabase Dashboard** → **SQL Editor**
2. Execute o script `scripts/VERIFICAR_ESTRUTURA_TRANSACOES.sql`
3. Isso vai listar todas as colunas da tabela `nf.transações`

### Passo 2: Verificar os Nomes das Colunas

O script vai mostrar algo como:

```
column_name        | data_type    | is_nullable
-------------------|--------------|-------------
id                 | bigint       | NO
data               | date         | YES
id_posto           | bigint       | YES  <- Pode ser este
posto              | bigint       | YES  <- Ou este
id_empresa         | bigint       | YES  <- Ou este
...
```

### Passo 3: Informar os Nomes Corretos

Após descobrir os nomes corretos, me informe:
- **Coluna do posto**: `id_posto`, `posto`, `id_empresa`, ou outro?
- **Coluna do cliente**: `id_cliente`, `cliente`, `cliente_id`, ou outro?
- **Coluna do preço calculado**: `preco_calculado`, `preco`, `valor_calculado`, ou outro?
- **Coluna da data**: `data`, `data_transacao`, ou outro?
- **Coluna do produto**: `produto`, `tipo_produto`, ou outro?

### Passo 4: Ajustar a Função

Com os nomes corretos, vou ajustar o script `EXECUTAR_AGORA_DESCONTOS_INDEVIDOS.sql` para usar os nomes corretos.

## 🔄 Alternativa: Query Manual

Se preferir, você pode executar esta query diretamente no SQL Editor:

```sql
-- Ver todas as colunas da tabela
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'nf' 
  AND table_name = 'transações'
ORDER BY ordinal_position;
```

Ou, se a tabela não tiver acento:

```sql
SELECT column_name, data_type 
FROM information_schema.columns
WHERE table_schema = 'nf' 
  AND table_name LIKE '%trans%'
ORDER BY ordinal_position;
```

## 📝 Exemplo de Resposta

Após executar, me envie algo como:

```
Colunas encontradas:
- id (bigint)
- data (date)
- id_posto (bigint)  <- Nome correto do posto
- id_cliente (bigint)  <- Nome correto do cliente
- preco_calculado (numeric)  <- Nome correto do preço
- produto (text)  <- Nome correto do produto
```

Com essas informações, vou ajustar a função SQL corretamente!

