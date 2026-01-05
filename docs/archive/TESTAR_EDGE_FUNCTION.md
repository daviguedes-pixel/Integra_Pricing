# 🧪 Como Testar a Edge Function

## 📋 Método 1: Via Dashboard do Supabase

### Passo a Passo:

1. **Acesse:** Supabase Dashboard > **Edge Functions** > **send-push-notification**

2. **Clique em "Invoke"** (ou **"Invocar"**)

3. **Obtenha seu Token FCM:**
   - Abra o console do navegador (F12)
   - Execute:
   ```javascript
   const { data } = await supabase
     .from('push_subscriptions')
     .select('fcm_token')
     .limit(1);
   
   console.log('Token FCM:', data[0]?.fcm_token);
   ```
   - Copie o token

4. **Cole este JSON no Invoke:**
   ```json
   {
     "token": "COLE-SEU-TOKEN-FCM-AQUI",
     "notification": {
       "title": "Teste via Dashboard",
       "body": "Esta é uma notificação de teste"
     },
     "data": {
       "url": "/dashboard",
       "tag": "test"
     }
   }
   ```

5. **Clique em "Invoke"**

6. **Verifique os Logs:**
   - Veja se aparece `✅ Push enviado com sucesso`
   - Ou se há algum erro

## 📋 Método 2: Via Console do Navegador

1. **Abra o Console** (F12)

2. **Execute:**
   ```javascript
   // Obter token FCM
   const { data } = await supabase
     .from('push_subscriptions')
     .select('fcm_token')
     .limit(1);
   
   const token = data[0]?.fcm_token;
   console.log('Token:', token);

   // Chamar Edge Function
   const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
     body: {
       token: token,
       notification: {
         title: 'Teste via Console',
         body: 'Testando notificação push'
       },
       data: {
         url: '/dashboard'
       }
     }
   });

   console.log('Resultado:', result);
   console.log('Erro:', error);
   ```

## 🐛 Verificar Erros Comuns

### "Function not found"
- A Edge Function não foi deployada
- Verifique se está no Dashboard

### "401 Unauthorized"
- Access Token expirado ou incorreto
- Gere um novo: `node get-firebase-token.js`

### "403 Forbidden"
- Access Token não tem permissão
- Verifique o Service Account

### "404 Not Found" (do Firebase)
- Token FCM inválido ou expirado
- Ative as notificações novamente

## 📊 Verificar Logs

No **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Logs**:

Procure por:
- `📤 Enviando push notification via FCM V1 API`
- `✅ Push enviado com sucesso`
- `❌ Erro ao enviar push`

---

**Teste e me diga o que aparece nos logs!**

