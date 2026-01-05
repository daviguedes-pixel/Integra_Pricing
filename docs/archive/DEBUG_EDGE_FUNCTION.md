# 🐛 Debug: Edge Function não está enviando notificações

## 🔍 Verificações

### 1. Verificar se a Edge Function foi chamada

No **Supabase Dashboard**:
1. Vá em **Edge Functions** > **send-push-notification**
2. Clique em **"Logs"** (ou **"Registros"**)
3. Verifique se há requisições sendo feitas
4. Veja se há erros em vermelho

### 2. Verificar se o Access Token está configurado

1. **Edge Functions** > **Settings** > **Secrets**
2. Verifique se `FIREBASE_ACCESS_TOKEN` existe
3. Verifique se o valor está correto (não expirou)

### 3. Verificar se o token FCM está correto

No console do navegador (F12), execute:

```javascript
// Verificar se há token salvo
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .eq('user_id', 'SEU-USER-ID');

console.log('Tokens FCM:', data);
```

### 4. Testar a Edge Function diretamente

No **Supabase Dashboard**:
1. Vá em **Edge Functions** > **send-push-notification**
2. Clique em **"Invoke"** (ou **"Invocar"**)
3. Cole este JSON:

```json
{
  "token": "SEU-TOKEN-FCM-AQUI",
  "notification": {
    "title": "Teste",
    "body": "Esta é uma notificação de teste"
  },
  "data": {
    "url": "/dashboard"
  }
}
```

4. Clique em **"Invoke"**
5. Veja os logs para verificar erros

### 5. Verificar erros comuns

#### Erro: "401 Unauthorized"
- **Causa:** Access Token expirado ou incorreto
- **Solução:** Gere um novo token: `node get-firebase-token.js`

#### Erro: "403 Forbidden"
- **Causa:** Access Token não tem permissão
- **Solução:** Verifique se o Service Account tem permissões corretas

#### Erro: "404 Not Found"
- **Causa:** Token FCM inválido ou expirado
- **Solução:** Ative as notificações novamente em `/settings`

#### Erro: "Function not found"
- **Causa:** Edge Function não foi deployada
- **Solução:** Faça o deploy novamente

## 🧪 Testar Manualmente

### Via Console do Navegador:

```javascript
// Obter seu token FCM
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .eq('user_id', 'SEU-USER-ID');

const fcmToken = data[0]?.fcm_token;

// Chamar Edge Function diretamente
const response = await supabase.functions.invoke('send-push-notification', {
  body: {
    token: fcmToken,
    notification: {
      title: 'Teste Manual',
      body: 'Testando via console'
    },
    data: {
      url: '/dashboard'
    }
  }
});

console.log('Resposta:', response);
```

## 📊 Verificar Logs

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Logs**
2. Procure por:
   - `📤 Enviando push notification`
   - `✅ Push enviado com sucesso`
   - `❌ Erro ao enviar push`

## 💡 Próximos Passos

1. Verifique os logs da Edge Function
2. Teste a função diretamente pelo Dashboard
3. Verifique se o Access Token não expirou
4. Me diga qual erro aparece nos logs

