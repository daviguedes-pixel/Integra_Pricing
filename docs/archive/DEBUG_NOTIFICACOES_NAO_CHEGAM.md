# 🔍 Debug: Notificações Não Chegam

## ✅ O que está funcionando:
- Firebase configurado ✅
- Service Worker registrado ✅
- Token FCM obtido ✅
- Mensagem "Notificação de teste enviada!" aparece ✅

## ❌ O que não está funcionando:
- Notificação push não aparece ❌

## 🔍 Verificações Necessárias:

### 1. Verificar se Token FCM está no banco

Execute no Console (F12):
```javascript
const { data, error } = await supabase
  .from('push_subscriptions')
  .select('*');

console.log('Tokens no banco:', data);
console.log('Erro:', error);
```

### 2. Verificar se Edge Function está sendo chamada

No Console, quando clicar em "Enviar Teste", deve aparecer:
- `🔔 Iniciando envio de push notification...`
- `📱 Encontrados X token(s) FCM...`
- `📤 Tentando enviar push via Edge Function...`
- `✅ Resposta da Edge Function:` ou `❌ Erro...`

### 3. Verificar Logs da Edge Function

1. Supabase Dashboard > Edge Functions > send-push-notification > Logs
2. Procure por:
   - `🔑 Obtendo Access Token...`
   - `✅ Access Token obtido`
   - `📤 Enviando push notification`
   - `✅ Push enviado com sucesso`
   - OU erros em vermelho

### 4. Verificar Service Account JSON

1. Supabase Dashboard > Edge Functions > Settings > Secrets
2. Deve ter `FIREBASE_SERVICE_ACCOUNT_JSON` configurado
3. OU `FIREBASE_ACCESS_TOKEN` (mas expira em 1 hora)

### 5. Testar Edge Function Diretamente

No Console (F12):
```javascript
// Obter token FCM
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .limit(1);

const token = data[0]?.fcm_token;
console.log('Token:', token);

// Chamar Edge Function diretamente
const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
  body: {
    token: token,
    notification: {
      title: 'Teste Direto',
      body: 'Testando via Console'
    },
    data: {
      url: '/dashboard'
    }
  }
});

console.log('Resultado:', result);
console.log('Erro:', error);
```

## 🐛 Problemas Comuns:

### "Function not found"
- Edge Function não foi deployada
- Faça deploy via Dashboard

### "FIREBASE_SERVICE_ACCOUNT_JSON não configurado"
- Configure no Dashboard > Edge Functions > Settings > Secrets

### "403 Forbidden" do Firebase
- Access Token sem permissão
- Service Account sem permissão no Firebase

### "404 Not Found" do Firebase
- Token FCM inválido ou expirado
- Ative as notificações novamente

### Notificação não aparece mas Edge Function retorna sucesso
- Permissão do navegador bloqueada
- Service Worker não está recebendo mensagens
- Verifique permissões do navegador

---

**Me envie os resultados dessas verificações!**

