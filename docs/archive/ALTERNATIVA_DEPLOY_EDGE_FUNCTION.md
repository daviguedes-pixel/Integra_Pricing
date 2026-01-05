# 🔄 Alternativa: Deploy da Edge Function sem CLI

Se o login do Supabase CLI não funcionar, você pode fazer o deploy diretamente pelo Dashboard do Supabase.

## 📋 Método: Deploy via Dashboard

### 1. Preparar a Edge Function

A Edge Function já está criada em:
- `supabase/functions/send-push-notification/index.ts`

### 2. Fazer Deploy pelo Dashboard

1. **Acesse:** Supabase Dashboard > **Edge Functions**
2. Clique em **"Create a new function"** (ou **"Criar nova função"**)
3. Nome: `send-push-notification`
4. **Copie o conteúdo** de `supabase/functions/send-push-notification/index.ts`
5. Cole no editor do Dashboard
6. Clique em **"Deploy"** (ou **"Publicar"**)

### 3. Configurar Variável de Ambiente

1. Vá em **Edge Functions** > **Settings** > **Secrets**
2. Adicione:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o Access Token do Firebase
3. Salve

## 🔧 Alternativa: Usar Access Token via Código

Se o deploy pelo Dashboard também não funcionar, podemos criar uma função que usa o token diretamente do código (não recomendado para produção, mas funciona para testes).

## 📝 Conteúdo da Edge Function

O arquivo `supabase/functions/send-push-notification/index.ts` já está pronto. Você só precisa:
1. Copiar o conteúdo
2. Colar no Dashboard do Supabase
3. Fazer deploy

## ✅ Após Deploy

Teste usando o botão "Enviar Teste" em `/settings`.

---

**Nota:** Se preferir, posso ajudar a criar uma versão simplificada que funcione sem Edge Function, usando apenas o Firebase Console para enviar notificações.

