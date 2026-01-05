# 🚀 Configurar Edge Function para Push Notifications - Guia Completo

## 📋 Pré-requisitos

1. Conta no Supabase
2. Supabase CLI instalado
3. Server Key do Firebase (obtida do Firebase Console)

## 🔑 Passo 1: Obter Server Key do Firebase

A **Server Key** é diferente da API Key do cliente. Ela é necessária para enviar notificações push.

### Como obter:

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto **notifica-6e935**
3. Vá em **Configurações do Projeto** (ícone de engrenagem)
4. Aba **Cloud Messaging**
5. Procure por **"Cloud Messaging API (Legacy)"** ou **"Server Key"**
6. **Copie a Server Key** (é uma string longa)

**⚠️ IMPORTANTE:** Se não encontrar a Server Key:
- A API Legacy pode estar desabilitada
- Vá em **Cloud Messaging** > **Cloud Messaging API (Legacy)** > **Habilitar**
- Ou use o método alternativo abaixo

## 📦 Passo 2: Instalar Supabase CLI

```bash
# Windows (PowerShell)
npm install -g supabase

# Verificar instalação
supabase --version
```

## 🔐 Passo 3: Fazer Login no Supabase

```bash
supabase login
```

Isso abrirá o navegador para você fazer login.

## 🔗 Passo 4: Linkar Projeto

```bash
# Obter o Project Reference ID do Supabase Dashboard
# Vá em: Settings > General > Reference ID

supabase link --project-ref seu-project-ref-aqui
```

## ⚙️ Passo 5: Configurar Variável de Ambiente

No **Supabase Dashboard**:

1. Vá em **Edge Functions** > **Settings**
2. Em **Secrets**, clique em **Add new secret**
3. Adicione:
   - **Name:** `FIREBASE_SERVER_KEY`
   - **Value:** Cole a Server Key que você copiou do Firebase Console
4. Clique em **Save**

## 🚀 Passo 6: Fazer Deploy da Edge Function

```bash
# Na raiz do projeto
supabase functions deploy send-push-notification
```

## ✅ Passo 7: Testar

Após o deploy, teste usando o botão "Enviar Teste" em `/settings` ou via código:

```typescript
import { sendPushNotification } from '@/lib/pushNotification';

await sendPushNotification(userId, {
  title: 'Teste',
  body: 'Esta é uma notificação de teste'
});
```

## 🐛 Troubleshooting

### "FIREBASE_SERVER_KEY não configurada"

**Solução:**
- Verifique se adicionou a variável no Supabase Dashboard
- Certifique-se de que o nome está exatamente: `FIREBASE_SERVER_KEY`
- Faça deploy novamente após adicionar

### "401 Unauthorized"

**Solução:**
- Verifique se a Server Key está correta
- Certifique-se de que copiou a Server Key completa (não a API Key)

### "403 Forbidden"

**Solução:**
- A Server Key pode estar incorreta
- Verifique se habilitou a Cloud Messaging API (Legacy) no Firebase

### "Function not found"

**Solução:**
- Certifique-se de que fez o deploy: `supabase functions deploy send-push-notification`
- Verifique se está linkado ao projeto correto: `supabase link`

## 📝 Estrutura da Edge Function

A Edge Function está em:
- `supabase/functions/send-push-notification/index.ts`

Ela recebe:
```json
{
  "token": "fcm-token-do-usuario",
  "notification": {
    "title": "Título",
    "body": "Mensagem",
    "icon": "/favicon.ico"
  },
  "data": {
    "url": "/dashboard",
    "tag": "notification"
  }
}
```

## 🔄 Atualizar Edge Function

Se fizer alterações na Edge Function:

```bash
supabase functions deploy send-push-notification
```

## 📚 Recursos

- [Documentação Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)

---

**Pronto!** Após configurar, o botão "Enviar Teste" deve funcionar! 🎉

