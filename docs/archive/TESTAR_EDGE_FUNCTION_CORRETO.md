# ✅ Como Testar Edge Function Corretamente

## 🎯 Você recebeu: "Token FCM é obrigatório" (400)

Isso significa que a Edge Function está funcionando, mas o JSON está incorreto!

## 📋 Passo a Passo Correto:

### 1. Obter Token FCM do Banco

No Console do navegador (F12), execute:

```javascript
const { data, error } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .limit(1);

if (data && data.length > 0) {
  console.log('✅ Token FCM:', data[0].fcm_token);
  // Copie este token!
} else {
  console.error('❌ Nenhum token encontrado!');
  console.error('💡 Ative as notificações push em /settings primeiro');
}
```

### 2. Usar JSON Correto no Dashboard

No **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Invoke**:

**Substitua o Request Body por:**

```json
{
  "token": "COLE-SEU-TOKEN-FCM-AQUI",
  "notification": {
    "title": "🧪 Teste via Dashboard",
    "body": "Esta é uma notificação de teste"
  },
  "data": {
    "url": "/dashboard",
    "tag": "test"
  }
}
```

**⚠️ IMPORTANTE:** Substitua `COLE-SEU-TOKEN-FCM-AQUI` pelo token que você copiou do passo 1!

### 3. Clicar em "Send Request"

### 4. Verificar Resultado

**Se der sucesso (200):**
- ✅ Edge Function funcionou!
- ✅ Notificação foi enviada para o Firebase
- Se não aparecer no navegador, verifique permissões

**Se der erro:**
- Veja qual erro aparece
- Me diga qual é o erro

## 🔍 Estrutura Correta do JSON:

```json
{
  "token": "c-H3BvYWA1D0a6kInVq0Ub:APA91bGdGREeR9V7hvdb0LAiwhx...",
  "notification": {
    "title": "Título da Notificação",
    "body": "Corpo da Notificação",
    "icon": "/favicon.ico",
    "badge": "/favicon.ico"
  },
  "data": {
    "url": "/dashboard",
    "tag": "notification"
  }
}
```

## 📋 Campos Obrigatórios:

- ✅ `token` - Token FCM (obrigatório)
- ✅ `notification.title` - Título (obrigatório)
- ✅ `notification.body` - Corpo (obrigatório)
- ⚪ `notification.icon` - Ícone (opcional)
- ⚪ `notification.badge` - Badge (opcional)
- ⚪ `data` - Dados extras (opcional)

---

**Agora teste novamente com o JSON correto!** 🚀

