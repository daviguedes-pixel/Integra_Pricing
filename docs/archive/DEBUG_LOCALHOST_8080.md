# 🔍 Debug: Notificações em localhost:8080

## ✅ Localhost:8080 é Suportado

Firebase Messaging funciona perfeitamente em `localhost:8080` (qualquer porta de localhost funciona).

## 🔍 Verificações Específicas para localhost:8080

### 1. Verificar Console do Navegador (F12)

Quando você clica em "Enviar Teste", procure por:

```
🔔 Iniciando envio de push notification...
📱 Encontrados 1 token(s) FCM...
📤 Tentando enviar push via Edge Function...
```

**Me diga o que aparece!**

### 2. Verificar se Token FCM está no Banco

No Console (F12), execute:

```javascript
const { data, error } = await supabase
  .from('push_subscriptions')
  .select('*');

console.log('Tokens no banco:', data);
console.log('Erro:', error);
```

**Me diga o que aparece!**

### 3. Verificar Logs da Edge Function

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Logs**
2. Procure por requisições recentes
3. Veja se há erros em vermelho

**Me diga o que aparece nos logs!**

### 4. Verificar Service Account JSON

1. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Deve ter `FIREBASE_SERVICE_ACCOUNT_JSON` configurado
3. **OU** `FIREBASE_ACCESS_TOKEN` (mas expira em 1 hora)

**Está configurado? Qual?**

### 5. Testar Edge Function Diretamente

No Console (F12), execute:

```javascript
// 1. Obter token FCM
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .limit(1);

const token = data[0]?.fcm_token;
console.log('Token FCM:', token);

if (!token) {
  console.error('❌ Nenhum token FCM encontrado!');
  console.error('💡 Ative as notificações push em /settings primeiro');
} else {
  // 2. Chamar Edge Function
  console.log('📤 Chamando Edge Function...');
  const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      token: token,
      notification: {
        title: 'Teste Direto localhost:8080',
        body: 'Testando notificação push'
      },
      data: {
        url: '/dashboard'
      }
    }
  });

  console.log('✅ Resultado:', result);
  console.log('❌ Erro:', error);
  
  if (error) {
    console.error('📋 Detalhes do erro:', {
      message: error.message,
      status: error.status,
      context: error.context
    });
  }
}
```

**Me diga o que aparece!**

## 🐛 Problemas Comuns em localhost:8080

### "Function not found"
- **Causa:** Edge Function não foi deployada
- **Solução:** Faça deploy via Dashboard

### "FIREBASE_SERVICE_ACCOUNT_JSON não configurado"
- **Causa:** Secret não configurado
- **Solução:** Configure no Dashboard > Edge Functions > Settings > Secrets

### "403 Forbidden" do Firebase
- **Causa:** Access Token sem permissão ou Service Account sem permissão
- **Solução:** Verifique permissões do Service Account no Firebase Console

### "404 Not Found" do Firebase
- **Causa:** Token FCM inválido ou expirado
- **Solução:** Ative as notificações novamente em `/settings`

### Notificação não aparece mas Edge Function retorna sucesso
- **Causa:** Permissão do navegador bloqueada ou Service Worker não recebe mensagens
- **Solução:**
  1. Verifique permissões do navegador (ícone de cadeado > Notificações > Permitir)
  2. Verifique se Service Worker está ativo (DevTools > Application > Service Workers)

## 📋 Checklist Completo

- [ ] Token FCM está no banco?
- [ ] Edge Function está deployada?
- [ ] Service Account JSON está configurado?
- [ ] Logs da Edge Function mostram sucesso?
- [ ] Permissões do navegador estão ativas?
- [ ] Service Worker está registrado e ativo?

---

**Execute o teste direto acima e me diga o que aparece!** 🔍

