# 🔍 Diagnóstico Completo - Push Notifications Não Aparecem

## ❌ Problema:
- Edge Function retorna sucesso ✅
- Mas notificação não aparece ❌
- Nada aparece no console ❌

## 🔍 Possíveis Causas:

### 1. Service Worker não está recebendo mensagens do Firebase

**Sintoma:** Nada aparece no console quando você testa

**Verificar:**
1. Service Worker está ativo? (Application > Service Workers)
2. Firebase foi inicializado no Service Worker?
3. Token FCM é válido?

### 2. Service Worker não está inicializado corretamente

**Sintoma:** Service Worker existe mas Firebase não foi inicializado

**Verificar no console principal:**
- Deve aparecer: `✅ Firebase inicializado no Service Worker`
- Se não aparecer, o Service Worker não recebeu a configuração

### 3. Token FCM inválido ou expirado

**Sintoma:** Edge Function retorna sucesso mas Firebase não entrega

**Verificar:**
- Token FCM ainda é válido?
- Ative as notificações novamente em `/settings`

## 🧪 Teste Completo:

### Passo 1: Verificar Service Worker

No Console (F12), execute:

```javascript
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker:', reg ? '✅ Registrado' : '❌ Não registrado');
  if (reg) {
    console.log('   Active:', reg.active ? '✅' : '❌');
    console.log('   Waiting:', reg.waiting ? '⚠️' : '✅');
    console.log('   Scope:', reg.scope);
  }
});
```

### Passo 2: Verificar Firebase no Service Worker

No Console (F12), execute:

```javascript
// Verificar se Firebase foi inicializado
navigator.serviceWorker.getRegistration().then(reg => {
  if (reg && reg.active) {
    reg.active.postMessage({ type: 'CHECK_FIREBASE' });
    console.log('✅ Mensagem de verificação enviada para Service Worker');
  }
});
```

### Passo 3: Testar Notificação Diretamente

No Console (F12), execute:

```javascript
// Obter token
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
      title: 'Teste Direto',
      body: 'Testando'
    },
    data: { url: '/dashboard' }
  }
});

console.log('Resultado:', result);
console.log('Erro:', error);

// MINIMIZE A JANELA AGORA e aguarde
```

## 🐛 Se Nada Aparecer no Console:

Isso significa que o Service Worker **NÃO está recebendo** as mensagens do Firebase.

**Possíveis causas:**
1. Service Worker não está ativo
2. Firebase não foi inicializado no Service Worker
3. Token FCM inválido
4. Service Worker não está escutando mensagens

**Solução:**
1. Desregistre todos os Service Workers
2. Recarregue a página
3. Verifique se aparece `✅ Firebase inicializado no Service Worker` no console
4. Teste novamente

---

**Execute os testes acima e me diga o que aparece!**

