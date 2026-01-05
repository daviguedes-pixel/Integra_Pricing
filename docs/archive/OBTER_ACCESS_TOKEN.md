# 🔑 Como Obter Access Token do Firebase (API V1)

Como a API Legacy está desativada, precisamos usar a **API V1** do Firebase, que requer um **Access Token** via OAuth 2.0.

## 📋 Método 1: Usar Service Account (Recomendado)

### Passo 1: Criar Service Account

1. Acesse: https://console.firebase.google.com/project/notifica-6e935/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Baixe o arquivo JSON (ex: `firebase-service-account.json`)

### Passo 2: Obter Access Token

Você pode obter o Access Token de duas formas:

#### Opção A: Via Script Node.js (Mais Fácil)

Crie um arquivo `get-token.js`:

```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Obter Access Token
admin.credential.cert(serviceAccount).getAccessToken()
  .then(token => {
    console.log('Access Token:', token.access_token);
    console.log('\n⚠️ IMPORTANTE: Este token expira em 1 hora!');
    console.log('Configure FIREBASE_ACCESS_TOKEN no Supabase Dashboard com este valor.');
  })
  .catch(error => {
    console.error('Erro:', error);
  });
```

Execute:
```bash
npm install firebase-admin
node get-token.js
```

#### Opção B: Via Google Cloud SDK

```bash
# Instalar gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Autenticar
gcloud auth application-default login

# Obter token
gcloud auth print-access-token
```

### Passo 3: Configurar no Supabase

1. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Adicione:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o Access Token obtido
3. Salve

**⚠️ IMPORTANTE:** O Access Token expira em 1 hora! Você precisará renová-lo periodicamente ou usar Service Account diretamente.

## 📋 Método 2: Usar Service Account JSON Diretamente (Melhor para Produção)

Em vez de usar Access Token (que expira), você pode usar o Service Account JSON diretamente na Edge Function.

### Atualizar Edge Function

A Edge Function precisaria ser atualizada para ler o Service Account JSON e gerar o token automaticamente. Isso requer instalar `firebase-admin` na Edge Function.

## 🔄 Renovação Automática do Token

Para produção, você pode:
1. Criar um cron job que renova o token periodicamente
2. Ou atualizar a Edge Function para gerar o token automaticamente usando Service Account

## 💡 Solução Temporária (Para Testar)

Para testar rapidamente:

1. Use o **Firebase Console** para enviar notificações (não requer token)
2. Ou obtenha um Access Token temporário usando o Método 1 acima

## 📚 Recursos

- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [OAuth 2.0 para Service Accounts](https://developers.google.com/identity/protocols/oauth2/service-account)

---

**Nota:** Para produção, recomendo usar Service Account JSON diretamente na Edge Function para evitar expiração de tokens.

