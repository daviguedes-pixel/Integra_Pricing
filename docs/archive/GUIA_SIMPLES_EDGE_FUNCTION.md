# 🚀 Guia Simples: Configurar Edge Function

## ⚠️ Situação Atual

A **API Legacy está desativada** no seu projeto Firebase. Precisamos usar a **API V1**, que requer um **Access Token**.

## 📋 Passo a Passo Simplificado

### 1️⃣ Baixar Service Account JSON (2 min)

1. Acesse: https://console.firebase.google.com/project/notifica-6e935/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Baixe o arquivo JSON
4. Salve como `firebase-service-account.json` na **raiz do projeto**

### 2️⃣ Obter Access Token (1 min)

```bash
# Instalar dependência
npm install firebase-admin

# Executar script
node get-firebase-token.js
```

O script vai mostrar o Access Token. **Copie esse token!**

### 3️⃣ Instalar Supabase CLI (1 min)

**Opção A: Via npm local (Mais fácil)**
```bash
npm install --save-dev supabase
```

**Opção B: Via Scoop (Windows)**
```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

Veja `INSTALAR_SUPABASE_CLI_WINDOWS.md` para mais opções.

### 4️⃣ Fazer Login e Linkar (1 min)

**Se instalou via npm local:**
```bash
# Login
npx supabase login

# Linkar (obtenha o Project Reference ID no Supabase Dashboard)
npx supabase link --project-ref SEU-PROJECT-REF
```

**Se instalou globalmente:**
```bash
# Login
supabase login

# Linkar
supabase link --project-ref SEU-PROJECT-REF
```

### 5️⃣ Configurar Token no Supabase (1 min)

1. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Clique em **"Add new secret"**
3. Adicione:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o token do passo 2
4. Salve

### 6️⃣ Fazer Deploy (30 seg)

**Se instalou via npm local:**
```bash
npx supabase functions deploy send-push-notification
```

**Se instalou globalmente:**
```bash
supabase functions deploy send-push-notification
```

## ✅ Pronto!

Agora teste:
- Clique em **"Enviar Teste"** em `/settings`
- Você deve receber a notificação!

## ⚠️ Importante

O Access Token **expira em 1 hora**. Para produção:
- Use Service Account JSON diretamente na Edge Function
- Ou renove o token periodicamente

## 🐛 Problemas?

### "firebase-service-account.json não encontrado"
- Verifique se baixou o arquivo do Firebase Console
- Verifique se está na raiz do projeto

### "Token expirado"
- Execute `node get-firebase-token.js` novamente
- Atualize no Supabase Dashboard

### "Function not found"
- Verifique se fez o deploy: `supabase functions deploy send-push-notification`

---

**Tempo total:** ~5 minutos ⏱️

