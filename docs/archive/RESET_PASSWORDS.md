# Reset de Senhas para sr123

Este guia explica como resetar todas as senhas dos usuários para "sr123".

## Opção 1: Usando a Função Edge (Recomendado)

### Passo 1: Deploy da Função Edge

```bash
# Na raiz do projeto
supabase functions deploy reset-passwords
```

### Passo 2: Executar a Função

```bash
# Obter o token de acesso
supabase functions serve reset-passwords

# Ou fazer uma requisição HTTP diretamente
curl -X POST \
  'https://seu-projeto.supabase.co/functions/v1/reset-passwords' \
  -H 'Authorization: Bearer SEU_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json'
```

## Opção 2: Usando o Dashboard do Supabase

1. Acesse o Dashboard do Supabase
2. Vá em Authentication > Users
3. Para cada usuário:
   - Clique nos três pontos (...)
   - Selecione "Reset Password"
   - Defina a senha como "sr123"

## Opção 3: Usando SQL direto (Apenas marca como temporária)

Execute a migração SQL:

```bash
supabase migration up
```

Isso marcará todos os usuários como tendo senha temporária. Para resetar as senhas de fato, você precisará usar uma das opções acima.

## Verificação

Após executar o reset, teste o login com:
- Email: qualquer email cadastrado
- Senha: sr123

O sistema deve solicitar a troca de senha na primeira entrada.

