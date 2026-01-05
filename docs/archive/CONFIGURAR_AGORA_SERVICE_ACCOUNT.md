# 🔑 Configurar Service Account JSON AGORA (Não Expira!)

## ✅ Você está certo! Service Account JSON NÃO expira!

O problema é que ele **não está configurado ainda**. Vamos configurar agora:

## 📋 Passo a Passo Rápido:

### 1. Baixar Service Account JSON

1. Acesse: https://console.firebase.google.com/project/notifica-6e935/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Baixe o arquivo JSON
4. **NÃO compartilhe este arquivo!** Ele contém credenciais sensíveis.

### 2. Configurar no Supabase Dashboard

1. **Acesse:** Supabase Dashboard > **Edge Functions** > **Settings** > **Secrets**
2. Clique em **"Add new secret"** (ou **"Adicionar novo segredo"**)
3. Adicione:
   - **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Abra o arquivo JSON que você baixou, copie **TODO o conteúdo** (desde `{` até `}`) e cole aqui
4. Clique em **Save** (ou **Salvar**)

**⚠️ IMPORTANTE:** Cole o JSON completo, incluindo todas as chaves:
```json
{
  "type": "service_account",
  "project_id": "...",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "...",
  "client_id": "...",
  "auth_uri": "...",
  "token_uri": "...",
  "auth_provider_x509_cert_url": "...",
  "client_x509_cert_url": "..."
}
```

### 3. Atualizar Edge Function (se necessário)

Se você já fez deploy antes, pode precisar fazer deploy novamente:

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification**
2. Cole o código de `CODIGO_EDGE_FUNCTION_SERVICE_ACCOUNT.txt`
3. Clique em **Save** (ou **Salvar**)

### 4. Testar

1. Volte para `/settings`
2. Clique em **"Testar Edge Function (Automático)"**
3. Deve funcionar agora!

## ✅ Pronto!

Depois de configurar, você **NÃO precisa mais trocar nada**! O Service Account JSON:
- ✅ **NÃO expira**
- ✅ Gera tokens automaticamente
- ✅ Renova tokens antes de expirar
- ✅ Funciona para sempre

---

**Configure agora e teste!** 🚀

