# 🚀 Deploy Rápido da Edge Function send-push-notification

## ⚠️ Problema: 404 Not Found

Se você está recebendo erro `404 (Not Found)` ao chamar `send-push-notification`, significa que a Edge Function não foi deployada no Supabase.

## ✅ Solução: Deploy via Dashboard (Mais Fácil)

### Passo 1: Acessar Edge Functions

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. No menu lateral, clique em **Edge Functions**

### Passo 2: Criar/Editar a Função

1. Se já existe `send-push-notification`, clique nela
2. Se não existe, clique em **"Create a new function"** ou **"New Function"**
3. Nome: `send-push-notification`

### Passo 3: Copiar o Código

1. Abra o arquivo: `supabase/functions/send-push-notification/index.ts`
2. Copie **TODO** o conteúdo
3. Cole no editor do Dashboard

### Passo 4: Configurar Secrets (IMPORTANTE!)

1. No Dashboard, vá em **Edge Functions** > **Settings** (ou **Configurações**)
2. Clique em **Secrets** (ou **Environment Variables**)
3. Adicione o secret:

   **Nome:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   
   **Valor:** Cole o conteúdo completo do arquivo `firebase-service-account.json` (como JSON string)

   **OU** (alternativa mais simples, mas expira em 1 hora):
   
   **Nome:** `FIREBASE_ACCESS_TOKEN`
   
   **Valor:** Cole um Access Token do Firebase (obtido via `get-firebase-token.js`)

### Passo 5: Deploy

1. No editor da função, clique em **"Deploy"** ou **"Save"**
2. Aguarde o deploy completar (pode levar alguns segundos)

### Passo 6: Testar

1. Volte para `/settings` no seu app
2. Clique em **"Enviar Teste"**
3. Deve funcionar agora! ✅

## 🔧 Deploy via CLI (Alternativa)

Se você tem o Supabase CLI instalado:

```bash
# 1. Login
supabase login

# 2. Linkar projeto (use o project_ref do config.toml)
supabase link --project-ref ijygsxwfmribbjymxhaf

# 3. Deploy
supabase functions deploy send-push-notification
```

## ⚠️ Importante

- A Edge Function **deve** estar deployada para funcionar
- O erro 404 significa que ela não existe no servidor
- Após o deploy, o erro deve desaparecer

## 🐛 Ainda com Problemas?

1. Verifique se o nome da função está correto: `send-push-notification`
2. Verifique se os Secrets estão configurados
3. Verifique os logs: Edge Functions > send-push-notification > Logs

