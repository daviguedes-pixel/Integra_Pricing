# 🔍 Checklist de Debug - Notificações Push

## ✅ Verificações Básicas

### 1. Token FCM está sendo gerado?
- [ ] Abra o Console (F12)
- [ ] Procure por: `✅ Token FCM obtido:`
- [ ] Se não aparecer, verifique:
  - Permissão de notificação concedida?
  - Firebase configurado no `.env`?
  - Service Worker registrado?

### 2. Token está sendo salvo no banco?
- [ ] Console deve mostrar: `✅ Token FCM salvo no banco de dados`
- [ ] Verifique no Supabase Dashboard:
  - Table Editor > `push_subscriptions`
  - Deve ter uma linha com seu `user_id` e `fcm_token`

### 3. Edge Function está deployada?
- [ ] Supabase Dashboard > Edge Functions
- [ ] Deve aparecer `send-push-notification`
- [ ] Se não aparecer, faça deploy via Dashboard

### 4. Service Account JSON configurado?
- [ ] Supabase Dashboard > Edge Functions > Settings > Secrets
- [ ] Deve ter `FIREBASE_SERVICE_ACCOUNT_JSON`
- [ ] OU `FIREBASE_ACCESS_TOKEN` (mas expira em 1 hora)

## 🧪 Teste Passo a Passo

### Passo 1: Verificar Token FCM
```javascript
// No Console do navegador (F12)
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .limit(1);

console.log('Token FCM:', data[0]?.fcm_token);
```

### Passo 2: Testar Edge Function Diretamente
```javascript
// No Console do navegador (F12)
const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    token: 'COLE-SEU-TOKEN-AQUI',
    notification: {
      title: 'Teste',
      body: 'Testando notificação'
    },
    data: {
      url: '/dashboard'
    }
  }
});

console.log('Resultado:', result);
console.log('Erro:', error);
```

### Passo 3: Verificar Logs da Edge Function
- [ ] Supabase Dashboard > Edge Functions > send-push-notification > Logs
- [ ] Procure por:
  - `🔑 Obtendo Access Token...`
  - `✅ Access Token obtido`
  - `📤 Enviando push notification`
  - `✅ Push enviado com sucesso`
  - OU erros em vermelho

## 🐛 Erros Comuns

### "Function not found"
- **Causa:** Edge Function não foi deployada
- **Solução:** Faça deploy via Dashboard

### "FIREBASE_SERVICE_ACCOUNT_JSON não configurado"
- **Causa:** Secret não configurado
- **Solução:** Configure no Dashboard > Edge Functions > Settings > Secrets

### "Erro ao obter Access Token"
- **Causa:** Service Account JSON inválido ou Access Token expirado
- **Solução:** 
  - Verifique se o JSON está completo
  - Se usar Access Token, gere um novo

### "403 Forbidden" do Firebase
- **Causa:** Access Token sem permissão ou Service Account sem permissão
- **Solução:** Verifique permissões do Service Account no Firebase Console

### "404 Not Found" do Firebase
- **Causa:** Token FCM inválido ou expirado
- **Solução:** Ative as notificações novamente em `/settings`

### Notificação não aparece
- **Causa:** Permissão bloqueada ou Service Worker não registrado
- **Solução:**
  - Verifique permissões do navegador
  - Recarregue a página (Ctrl+Shift+R)
  - Verifique se está em HTTPS ou localhost

## 📊 Verificar Status Completo

Execute no Console:
```javascript
// Verificar Firebase
console.log('Firebase Config:', {
  apiKey: !!import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  vapidKey: !!import.meta.env.VITE_FIREBASE_VAPID_KEY
});

// Verificar Permissão
console.log('Permissão:', Notification.permission);

// Verificar Service Worker
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg ? 'Registrado' : 'Não registrado');
});

// Verificar Token no Banco
const { data } = await supabase
  .from('push_subscriptions')
  .select('*');
console.log('Tokens no banco:', data);
```

## 🎯 Próximos Passos

1. Execute o checklist acima
2. Anote todos os erros que aparecerem
3. Verifique os logs da Edge Function
4. Me envie:
   - Screenshot dos logs
   - Mensagens de erro do console
   - Status de cada verificação

---

**Com essas informações, consigo identificar exatamente onde está o problema!** 🔍

