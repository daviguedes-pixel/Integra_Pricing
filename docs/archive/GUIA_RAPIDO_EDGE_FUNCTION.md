# ⚡ Guia Rápido: Configurar Edge Function em 5 Minutos

## 🎯 Objetivo

Configurar a Edge Function do Supabase para enviar notificações push automaticamente.

## ⚠️ IMPORTANTE

Como a **API Legacy está desativada**, precisamos usar a **API V1** do Firebase, que requer um **Access Token**.

## 📋 Passo a Passo

### 1️⃣ Obter Access Token do Firebase (3 min)

**Opção A: Via Script Node.js (Recomendado)**

1. Crie um arquivo `get-token.js`:
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

admin.credential.cert(serviceAccount).getAccessToken()
  .then(token => {
    console.log('Access Token:', token.access_token);
    console.log('\n⚠️ Este token expira em 1 hora!');
  });
```

2. Baixe o Service Account JSON:
   - Firebase Console > Configurações > Contas de serviço
   - Clique em "Gerar nova chave privada"
   - Salve como `firebase-service-account.json`

3. Execute:
```bash
npm install firebase-admin
node get-token.js
```

**Opção B: Via Firebase Console (Temporário)**
- Use o Firebase Console para enviar notificações enquanto não configura

### 2️⃣ Instalar Supabase CLI (1 min)

```bash
npm install -g supabase
```

### 3️⃣ Fazer Login (30 seg)

```bash
supabase login
```

### 4️⃣ Linkar Projeto (1 min)

```bash
# Obtenha o Project Reference ID em:
# Supabase Dashboard > Settings > General > Reference ID

supabase link --project-ref SEU-PROJECT-REF-AQUI
```

### 5️⃣ Configurar Access Token no Supabase (1 min)

1. Acesse: **Supabase Dashboard** > **Edge Functions** > **Settings**
2. Em **Secrets**, clique em **"Add new secret"**
3. Adicione:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o Access Token do passo 1
4. Clique em **Save**

**⚠️ Lembrete:** O token expira em 1 hora. Para produção, use Service Account JSON diretamente.

### 6️⃣ Fazer Deploy (30 seg)

```bash
supabase functions deploy send-push-notification
```

## ✅ Pronto!

Agora teste:
- Clique em **"Enviar Teste"** em `/settings`
- Você deve receber a notificação push!

## 🐛 Problemas?

### "FIREBASE_ACCESS_TOKEN não configurada"
- Verifique se adicionou no Supabase Dashboard > Edge Functions > Settings > Secrets
- Nome deve ser exatamente: `FIREBASE_ACCESS_TOKEN`

### "401 Unauthorized"
- O Access Token pode ter expirado (expira em 1 hora)
- Gere um novo token e atualize no Supabase

### "Function not found"
- Verifique se fez o deploy: `supabase functions deploy send-push-notification`
- Verifique se está linkado: `supabase link --project-ref SEU-REF`

## 📚 Documentação Completa

- `OBTER_ACCESS_TOKEN.md` - Como obter o Access Token
- `CONFIGURAR_EDGE_FUNCTION_COMPLETO.md` - Guia detalhado

---

**Tempo total:** ~5 minutos ⏱️

**Nota:** Para produção, considere usar Service Account JSON diretamente para evitar expiração de tokens.
