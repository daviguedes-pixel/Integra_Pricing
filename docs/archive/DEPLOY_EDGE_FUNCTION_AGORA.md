# 🚀 Deploy da Edge Function - PASSO A PASSO RÁPIDO

## ⚠️ PROBLEMA: Erro 404 - Edge Function não encontrada

O erro 404 significa que a função **não está deployada** ou **não está acessível**. Siga estes passos:

## 📋 PASSO 1: Verificar se a função existe

1. Acesse: **Supabase Dashboard** > **Edge Functions**
2. Procure por `send-push-notification`
3. Se **NÃO existir**, vá para o **PASSO 2**
4. Se **existir**, vá para o **PASSO 3**

## 📋 PASSO 2: Criar a função (se não existir)

### Opção A: Via Dashboard (Mais Fácil)

1. **Supabase Dashboard** > **Edge Functions**
2. Clique em **"Deploy a new function"** (ou **"Criar nova função"**)
3. Nome: `send-push-notification`
4. Cole o código de: `supabase/functions/send-push-notification/index.ts`
5. Clique em **"Deploy"**

### Opção B: Via CLI

```bash
# Instalar Supabase CLI (se não tiver)
npm install -g supabase

# Fazer login
supabase login

# Linkar com seu projeto
supabase link --project-ref ijygsxwfmribbjymxhaf

# Fazer deploy
supabase functions deploy send-push-notification
```

## 📋 PASSO 3: Redeploy da função (se já existe)

Mesmo que a função exista, você precisa fazer um **novo deploy** com o código atualizado:

### Via Dashboard:

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification**
2. Clique em **"Edit"** (ou **"Editar"**)
3. Cole o código atualizado de: `supabase/functions/send-push-notification/index.ts`
4. Clique em **"Deploy"** (ou **"Fazer Deploy"**)
5. Aguarde o deploy terminar (pode levar 1-2 minutos)

### Via CLI:

```bash
supabase functions deploy send-push-notification
```

## 📋 PASSO 4: Verificar Secrets

Após o deploy, verifique se os secrets estão configurados:

1. **Edge Functions** > **Settings** > **Secrets**
2. Verifique se tem:
   - ✅ `FIREBASE_SERVICE_ACCOUNT_JSON` (recomendado)
   - OU
   - ✅ `FIREBASE_ACCESS_TOKEN` (expira em 1 hora)

## 📋 PASSO 5: Testar a função

### Teste 1: Via Dashboard

1. **Edge Functions** > **send-push-notification** > **Invoke**
2. Cole este JSON:
   ```json
   {
     "token": "SEU-TOKEN-FCM-AQUI",
     "notification": {
       "title": "Teste",
       "body": "Testando notificação"
     },
     "data": {
       "url": "/dashboard"
     }
   }
   ```
3. Clique em **"Invoke"**
4. Veja os logs para verificar se funcionou

### Teste 2: Via Frontend

1. Acesse `/settings` no seu app
2. Clique em **"Enviar Teste"**
3. Verifique o console (F12) para ver os logs

## 🐛 Problemas Comuns

### "Function not found" ou 404
- ✅ A função não foi deployada
- ✅ Faça o deploy novamente (PASSO 3)

### "401 Unauthorized"
- ✅ Access Token expirado (se usando FIREBASE_ACCESS_TOKEN)
- ✅ Gere um novo token e atualize no Dashboard

### "500 Internal Server Error"
- ✅ Verifique os logs da Edge Function
- ✅ Verifique se os secrets estão configurados corretamente

## ✅ Checklist Final

- [ ] Função `send-push-notification` existe no Dashboard
- [ ] Código atualizado foi deployado
- [ ] Secrets estão configurados (FIREBASE_SERVICE_ACCOUNT_JSON ou FIREBASE_ACCESS_TOKEN)
- [ ] Testei a função via Dashboard (Invoke)
- [ ] Testei a função via Frontend

## 💡 Dica Importante

**Se ainda der 404 após o deploy:**
1. Aguarde 2-3 minutos (pode levar um tempo para propagar)
2. Tente novamente
3. Verifique se o nome da função está correto: `send-push-notification` (sem espaços, tudo minúsculo)

---

**Se ainda não funcionar, me envie:**
1. Screenshot do Dashboard mostrando a função
2. Os logs da Edge Function (Edge Functions > send-push-notification > Logs)
3. O resultado do teste via Dashboard (Invoke)

