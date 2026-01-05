# 🚨 Resolver: Notificações Não Chegam

## ✅ O que está funcionando:
- Firebase configurado ✅
- Service Worker registrado ✅
- Token FCM obtido ✅
- Mensagem "Notificação de teste enviada!" aparece ✅

## ❌ Problema:
- Notificação push não aparece no navegador ❌

## 🔍 DIAGNÓSTICO RÁPIDO:

### 1. Verificar Console do Navegador (F12)

Quando você clica em "Enviar Teste", deve aparecer:

```
🔔 Iniciando envio de push notification...
📱 Encontrados 1 token(s) FCM...
📤 Tentando enviar push via Edge Function...
✅ Resposta da Edge Function: { success: true, ... }
✅ Push enviado com sucesso via Edge Function
```

**OU**

```
❌ Erro ao chamar Edge Function: ...
```

**Me diga o que aparece!**

### 2. Verificar Logs da Edge Function

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Logs**
2. Procure por:
   - `🔑 Obtendo Access Token...`
   - `✅ Access Token obtido`
   - `📤 Enviando push notification`
   - `✅ Push enviado com sucesso`
   - **OU erros em vermelho**

**Me diga o que aparece nos logs!**

### 3. Verificar Service Account JSON

1. **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Deve ter `FIREBASE_SERVICE_ACCOUNT_JSON` configurado
3. **OU** `FIREBASE_ACCESS_TOKEN` (mas expira em 1 hora)

**Está configurado? Qual?**

### 4. Verificar Permissões do Navegador

1. Clique no ícone de **cadeado** na barra de endereços
2. Verifique se **Notificações** está como **Permitir**
3. Se estiver bloqueado, mude para **Permitir**

**Está permitido?**

### 5. Testar Edge Function Diretamente

No Console do navegador (F12), execute:

```javascript
// 1. Obter token FCM
const { data } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .limit(1);

const token = data[0]?.fcm_token;
console.log('Token FCM:', token);

// 2. Chamar Edge Function
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

**Me diga o que aparece!**

## 🎯 PRÓXIMOS PASSOS:

1. **Execute o diagnóstico acima**
2. **Me envie:**
   - O que aparece no Console quando clica em "Enviar Teste"
   - O que aparece nos Logs da Edge Function
   - Se Service Account JSON está configurado
   - Resultado do teste direto da Edge Function

**Com essas informações, consigo identificar o problema exato!** 🔍

