# 🔴 Resolver Erro 404 na Edge Function

## 🎯 Problema

A Edge Function `send-push-notification` está retornando **404 Not Found**, mesmo estando criada no Dashboard.

## 🔍 Verificações Rápidas

### 1. Verificar Logs da Edge Function

1. Acesse: **Supabase Dashboard** > **Edge Functions** > **send-push-notification**
2. Clique em **"Logs"** (ou **"Registros"**)
3. Veja se há erros recentes
4. **Se não houver logs**, a função pode não estar sendo chamada corretamente

### 2. Testar a Função Diretamente no Dashboard

1. **Edge Functions** > **send-push-notification** > **Invoke** (ou **"Invocar"**)
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
4. Veja o resultado:
   - ✅ **Se funcionar:** O problema é na chamada do frontend
   - ❌ **Se der erro:** Veja qual erro aparece nos logs

### 3. Verificar Secrets Configurados

1. **Edge Functions** > **Settings** > **Secrets**
2. Verifique se tem:
   - ✅ `FIREBASE_SERVICE_ACCOUNT_JSON` (recomendado - não expira)
   - OU
   - ✅ `FIREBASE_ACCESS_TOKEN` (expira em 1 hora)

### 4. Se Está Usando FIREBASE_ACCESS_TOKEN

**⚠️ O Access Token expira em 1 hora!**

Se você está usando `FIREBASE_ACCESS_TOKEN` e está dando 404, pode ser que:
1. O token expirou
2. O token está incorreto

**Solução:**
1. Gere um novo Access Token (veja `OBTER_ACCESS_TOKEN.md`)
2. Atualize no Dashboard: **Edge Functions** > **Settings** > **Secrets** > `FIREBASE_ACCESS_TOKEN`
3. Faça um novo deploy da função

### 5. Usar Service Account JSON (Recomendado)

**Melhor solução:** Use `FIREBASE_SERVICE_ACCOUNT_JSON` em vez de `FIREBASE_ACCESS_TOKEN`:

1. **Firebase Console** > **Project Settings** > **Service Accounts**
2. Clique em **"Generate new private key"**
3. Baixe o arquivo JSON
4. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
5. Adicione:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Cole o conteúdo completo do JSON (todo o arquivo)
6. **Remova** `FIREBASE_ACCESS_TOKEN` (se existir)
7. Faça um novo deploy da função

**✅ Vantagem:** O Service Account JSON não expira e gera tokens automaticamente!

### 6. Redeploy da Função

Mesmo que a função já esteja criada, às vezes é necessário fazer um novo deploy:

1. **Edge Functions** > **send-push-notification**
2. Clique em **"Deploy"** (ou **"Fazer Deploy"**)
3. Aguarde o deploy terminar
4. Teste novamente

## 🐛 Erros Comuns

### "Function not found" ou 404
- ✅ Função não está deployada corretamente
- ✅ Access Token expirado (se usando FIREBASE_ACCESS_TOKEN)
- ✅ Problema de autenticação

### "401 Unauthorized"
- ✅ Access Token expirado
- ✅ Access Token incorreto
- ✅ Service Account JSON incorreto

### "500 Internal Server Error"
- ✅ Verifique os logs da Edge Function
- ✅ Verifique se os secrets estão configurados corretamente

## ✅ Checklist

- [ ] Verifiquei os logs da Edge Function
- [ ] Testei a função diretamente no Dashboard
- [ ] Verifiquei se os secrets estão configurados
- [ ] Se usando FIREBASE_ACCESS_TOKEN, gerei um novo token
- [ ] Fiz um novo deploy da função
- [ ] Testei novamente após o deploy

## 💡 Recomendação Final

**Use `FIREBASE_SERVICE_ACCOUNT_JSON` em vez de `FIREBASE_ACCESS_TOKEN`!**

O Service Account JSON:
- ✅ Não expira
- ✅ Gera tokens automaticamente
- ✅ É mais seguro
- ✅ É a solução recomendada para produção

---

**Se ainda não funcionar, me envie:**
1. Os logs da Edge Function
2. O resultado do teste direto no Dashboard
3. Qual secret está configurado (FIREBASE_ACCESS_TOKEN ou FIREBASE_SERVICE_ACCOUNT_JSON)

