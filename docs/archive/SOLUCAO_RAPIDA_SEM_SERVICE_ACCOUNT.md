# ⚡ Solução Rápida: Access Token Temporário (Sem Service Account JSON)

## 🎯 Situação

O Firebase removeu sua chave e você precisa de uma solução rápida **SEM** gerar Service Account JSON.

## ✅ Solução: Access Token Temporário

Você pode usar `FIREBASE_ACCESS_TOKEN` diretamente. Ele expira em 1 hora, mas funciona para testar.

## 📋 Como Obter Access Token (3 opções)

### Opção 1: Via Google Cloud Console (Mais Rápido)

1. Acesse: https://console.cloud.google.com/apis/credentials?project=notifica-6e935
2. Clique em **"Criar credenciais"** > **"ID do cliente OAuth"**
3. Configure:
   - Tipo: **Aplicativo da Web**
   - Nome: `Firebase Push Token`
4. Copie o **Client ID** e **Client Secret**
5. Use este script para obter o token:

```bash
# No terminal
curl -X POST https://oauth2.googleapis.com/token \
  -d "client_id=SEU_CLIENT_ID" \
  -d "client_secret=SEU_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  -d "scope=https://www.googleapis.com/auth/firebase.messaging"
```

### Opção 2: Via gcloud CLI (Se você tem instalado)

```bash
# Autenticar
gcloud auth application-default login

# Obter token
gcloud auth print-access-token --scopes=https://www.googleapis.com/auth/firebase.messaging
```

### Opção 3: Gerar Service Account Rápido (5 minutos)

Se você **REALMENTE** não quer usar Service Account, mas precisa de algo permanente:

1. Firebase Console > Configurações > Contas de serviço
2. Clique em **"Gerar nova chave privada"**
3. Baixe o JSON
4. Use este script Node.js para obter Access Token:

```javascript
// get-token.js
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.credential.cert(serviceAccount).getAccessToken()
  .then(token => {
    console.log('Access Token:', token.access_token);
    console.log('\n⚠️ Este token expira em 1 hora!');
    console.log('Configure FIREBASE_ACCESS_TOKEN no Supabase Dashboard.');
  });
```

Execute:
```bash
npm install firebase-admin
node get-token.js
```

## 🔧 Configurar no Supabase

1. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Adicione ou edite:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o Access Token obtido
3. **Remova** `FIREBASE_SERVICE_ACCOUNT_JSON` (se existir)
4. Salve

## ⚠️ IMPORTANTE

- ✅ Funciona **IMEDIATAMENTE**
- ❌ Expira em **1 hora**
- ⚠️ Você precisa **renovar manualmente** a cada hora
- 💡 Para produção, use Service Account JSON (não expira)

## 🔄 Renovar Token

Quando o token expirar (após 1 hora):

1. Execute o script novamente para obter novo token
2. Atualize no Supabase Dashboard
3. Pronto!

## 💡 Dica

Se você quer algo permanente sem Service Account, você pode:
- Criar um script que renova o token automaticamente
- Usar um cron job para atualizar o token no Supabase
- Mas é mais complicado que usar Service Account JSON

## ✅ Resumo

1. Obtenha Access Token (uma das 3 opções acima)
2. Configure `FIREBASE_ACCESS_TOKEN` no Supabase
3. Teste
4. Renove a cada 1 hora (ou configure Service Account JSON para não expirar)

