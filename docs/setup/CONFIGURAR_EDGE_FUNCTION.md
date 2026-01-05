# 🔧 Configurar Edge Function para Push Notifications

Para enviar notificações push via Firebase, você precisa criar uma Edge Function no Supabase.

## 📋 Opção 1: Usar Edge Function (Recomendado)

### 1. Instalar Supabase CLI

```bash
npm install -g supabase
```

### 2. Fazer Login

```bash
supabase login
```

### 3. Linkar Projeto

```bash
supabase link --project-ref seu-project-ref
```

### 4. Criar a Edge Function

```bash
supabase functions new send-push-notification
```

### 5. Configurar Variáveis de Ambiente

No Supabase Dashboard:
1. Vá em **Edge Functions** > **Settings**
2. Adicione as variáveis:
   - `FIREBASE_API_KEY` - Sua API Key do Firebase
   - `FIREBASE_ACCESS_TOKEN` - Access Token (opcional, para FCM v1)

### 6. Fazer Deploy

```bash
supabase functions deploy send-push-notification
```

## 📋 Opção 2: Usar Backend Próprio

Se você tem um backend Node.js, pode criar um endpoint que usa Firebase Admin SDK:

```javascript
const admin = require('firebase-admin');

// Inicializar
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Endpoint para enviar push
app.post('/api/send-push', async (req, res) => {
  const { token, notification, data } = req.body;
  
  const message = {
    notification: {
      title: notification.title,
      body: notification.body,
    },
    data: data || {},
    token: token,
    webpush: {
      notification: {
        icon: notification.icon || '/favicon.ico',
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    res.json({ success: true, messageId: response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 📋 Opção 3: Usar Serviço Externo

Você pode usar serviços como:
- OneSignal
- Pusher
- Ably
- Firebase Cloud Functions

## ✅ Após Configurar

A função `sendPushNotification` em `src/lib/pushNotification.ts` tentará usar a Edge Function automaticamente. Se não encontrar, usará métodos alternativos.

## 🧪 Testar

```typescript
import { sendPushNotification } from '@/lib/pushNotification';

await sendPushNotification('user-id', {
  title: 'Teste',
  body: 'Esta é uma notificação de teste',
  url: '/dashboard'
});
```

