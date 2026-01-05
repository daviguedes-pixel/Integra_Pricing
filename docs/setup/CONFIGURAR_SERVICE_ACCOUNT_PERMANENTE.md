# 🔑 Configurar Service Account JSON (Solução Permanente)

## 🎯 Por que usar Service Account JSON?

- ✅ **NÃO expira** (ao contrário do Access Token que expira em 1 hora)
- ✅ **Renovação automática** de tokens
- ✅ **Mais seguro** para produção
- ✅ **Configurar uma vez, usar para sempre**

## 📋 Passo a Passo

### 1. Baixar Service Account JSON

1. Acesse: https://console.firebase.google.com/project/notifica-6e935/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Baixe o arquivo JSON
4. **NÃO compartilhe este arquivo!** Ele contém credenciais sensíveis.

### 2. Configurar no Supabase Dashboard

1. **Acesse:** Supabase Dashboard > **Edge Functions** > **Settings** > **Secrets**
2. Clique em **"Add new secret"**
3. Adicione:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Abra o arquivo JSON que você baixou, copie **TODO o conteúdo** e cole aqui
4. Clique em **Save**

**⚠️ IMPORTANTE:** Cole o JSON completo, incluindo todas as chaves:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  ...
}
```

### 3. Atualizar Edge Function

A Edge Function já foi atualizada para usar Service Account JSON automaticamente!

Se você já fez deploy antes, faça deploy novamente com o código atualizado.

### 4. Remover FIREBASE_ACCESS_TOKEN (Opcional)

Se você tinha configurado `FIREBASE_ACCESS_TOKEN`, pode removê-lo agora:
- O Service Account JSON é suficiente
- A Edge Function vai gerar tokens automaticamente

## ✅ Pronto!

Agora a Edge Function vai:
- ✅ Gerar Access Tokens automaticamente
- ✅ Renovar tokens antes de expirar
- ✅ Funcionar sem precisar trocar nada manualmente

## 🧪 Testar

1. Clique em **"Enviar Teste"** em `/settings`
2. Você deve receber a notificação push!

## 🔒 Segurança

- ✅ O Service Account JSON fica seguro no Supabase (não é exposto)
- ✅ Tokens são gerados automaticamente e não ficam expostos
- ✅ Renovação automática evita expiração

---

**Agora você não precisa mais trocar tokens manualmente!** 🎉

