# 🧪 Como Testar Notificações Push

## ⚠️ Importante

A **API Key do cliente** (VITE_FIREBASE_API_KEY) **NÃO pode enviar notificações push**. Para enviar push, você precisa:

1. **Firebase Admin SDK** (no backend/Edge Function)
2. **OU** usar o **Firebase Console** (para testes)

## 🎯 Método 1: Testar via Firebase Console (Mais Fácil)

### Passo a Passo:

1. **Acesse o Firebase Console:**
   - https://console.firebase.google.com/
   - Selecione o projeto: **notifica-6e935**

2. **Vá em Cloud Messaging:**
   - Menu lateral > **Engage** > **Cloud Messaging**
   - Ou acesse diretamente: https://console.firebase.google.com/project/notifica-6e935/notification

3. **Crie uma Nova Campanha:**
   - Clique em **"Nova campanha"**
   - Selecione **"Notificação"**

4. **Configure a Notificação:**
   - **Título:** Teste
   - **Texto:** Esta é uma notificação de teste
   - Clique em **"Avançar"**

5. **Selecione Destinatários:**
   - Em **"Destinatários"**, selecione **"App web"**
   - Clique em **"Avançar"**

6. **Envie:**
   - Revise as informações
   - Clique em **"Revisar"** e depois **"Publicar"**

7. **Verifique:**
   - Você deve receber a notificação mesmo com o site fechado!

## 🔧 Método 2: Configurar Edge Function (Para Produção)

Para enviar push automaticamente via código, você precisa configurar uma Edge Function do Supabase.

### Passo a Passo:

1. **Instalar Supabase CLI:**
   ```bash
   npm install -g supabase
   ```

2. **Fazer Login:**
   ```bash
   supabase login
   ```

3. **Linkar Projeto:**
   ```bash
   supabase link --project-ref seu-project-ref
   ```

4. **Criar Edge Function:**
   ```bash
   supabase functions new send-push-notification
   ```

5. **Configurar Firebase Admin SDK na Edge Function**

6. **Fazer Deploy:**
   ```bash
   supabase functions deploy send-push-notification
   ```

Veja `CONFIGURAR_EDGE_FUNCTION.md` para instruções detalhadas.

## ✅ Verificar se Está Funcionando

### Checklist:

- ✅ Token FCM obtido (veja no console)
- ✅ Token salvo no banco (tabela `push_subscriptions`)
- ✅ Service Worker registrado
- ✅ Permissão de notificação concedida

### Testar:

1. **Via Firebase Console** (recomendado para teste):
   - Siga o Método 1 acima
   - Você deve receber a notificação

2. **Via Código** (requer Edge Function):
   - Clique no botão "Enviar Teste" em `/settings`
   - Só funcionará se a Edge Function estiver configurada

## 🐛 Problemas Comuns

### "Notificação não aparece"

**Solução:**
- Verifique se o token FCM está salvo no banco
- Teste via Firebase Console primeiro
- Verifique o console do navegador para erros

### "Edge Function não encontrada"

**Solução:**
- Isso é normal! A Edge Function precisa ser criada
- Use o Firebase Console para testar enquanto não configura
- Veja `CONFIGURAR_EDGE_FUNCTION.md` para configurar

### "API Key não tem permissão"

**Solução:**
- Isso é esperado! API Key do cliente não pode enviar push
- Use Firebase Console ou configure Edge Function

## 💡 Dica

**Para testar rapidamente:**
1. Ative as notificações em `/settings`
2. Use o Firebase Console para enviar uma notificação de teste
3. Você deve receber mesmo com o site fechado!

---

**Nota:** O botão "Enviar Teste" no site só funcionará após configurar a Edge Function. Use o Firebase Console para testar agora!

