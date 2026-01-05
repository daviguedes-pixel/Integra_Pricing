# 🔑 Como Obter a Server Key do Firebase

## ⚠️ IMPORTANTE

A **Server Key** é diferente da **API Key** do cliente. Você precisa da Server Key para enviar notificações push.

## 📋 Método 1: Server Key (Legacy API)

### Passo a Passo:

1. **Acesse Firebase Console:**
   - https://console.firebase.google.com/
   - Selecione o projeto: **notifica-6e935**

2. **Vá em Configurações:**
   - Clique no ícone de **engrenagem** (⚙️) ao lado de "Visão geral do projeto"
   - Selecione **"Configurações do projeto"**

3. **Aba Cloud Messaging:**
   - Vá na aba **"Cloud Messaging"**
   - Procure por **"Cloud Messaging API (Legacy)"**
   - Você verá a **"Server Key"** (string longa)
   - **Copie essa chave**

**⚠️ Se não aparecer a Server Key:**

### Habilitar Cloud Messaging API (Legacy):

1. Acesse: https://console.cloud.google.com/apis/library/fcm.googleapis.com
2. Selecione o projeto: **notifica-6e935**
3. Clique em **"Habilitar"**
4. Volte ao Firebase Console e a Server Key deve aparecer

## 📋 Método 2: Service Account (Recomendado para Produção)

Se a Server Key não estiver disponível, você pode usar Service Account:

1. **Firebase Console** > **Configurações do Projeto**
2. Aba **"Contas de serviço"**
3. Clique em **"Gerar nova chave privada"**
4. Baixe o arquivo JSON
5. Use esse JSON na Edge Function (requer código adicional)

## ✅ Após Obter a Server Key

1. Vá no **Supabase Dashboard**
2. **Edge Functions** > **Settings** > **Secrets**
3. Adicione:
   - **Name:** `FIREBASE_SERVER_KEY`
   - **Value:** Cole a Server Key
4. Salve
5. Faça deploy: `supabase functions deploy send-push-notification`

## 🔍 Verificar se Funcionou

Após configurar, teste:
- Clique em "Enviar Teste" em `/settings`
- Ou envie via Firebase Console
- Você deve receber a notificação!

---

**Nota:** A Server Key é sensível. Nunca a exponha no código do frontend!

