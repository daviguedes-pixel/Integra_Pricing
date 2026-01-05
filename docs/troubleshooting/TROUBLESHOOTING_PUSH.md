# 🔧 Troubleshooting: Notificações Push do Google

## ❌ Problema: Notificações não estão aparecendo

Siga este guia passo a passo para diagnosticar o problema:

## ✅ Checklist de Verificação

### 1. **Arquivo `.env` configurado?**

Verifique se o arquivo `.env` existe na raiz do projeto e tem todas as variáveis:

```env
VITE_FIREBASE_API_KEY=AIzaSyDOWFfM7bePXhXTiR9T7auiBB8RSiF4jZs
VITE_FIREBASE_AUTH_DOMAIN=notifica-6e935.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=notifica-6e935
VITE_FIREBASE_STORAGE_BUCKET=notifica-6e935.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=201676842130
VITE_FIREBASE_APP_ID=1:201676842130:web:73a61de5dabf4a66e1324b
VITE_FIREBASE_MEASUREMENT_ID=G-04XHJMG4X1
VITE_FIREBASE_VAPID_KEY=BP_5hFuOqmqyWQhYdjVKHE98UYEkPjDmBXM69swNHCksU8CmK9TkPjMZuNtRVyqVxXRprDaQGw0Hao60PuGbh98
```

**⚠️ IMPORTANTE:** Após criar/editar o `.env`, **REINICIE o servidor**:
```bash
# Pare o servidor (Ctrl+C) e inicie novamente
npm run dev
```

### 2. **Tabela `push_subscriptions` criada?**

Execute a migration SQL no Supabase:
- Arquivo: `supabase/migrations/20250122000000_create_push_subscriptions.sql`
- Ou execute diretamente no Supabase Dashboard > SQL Editor

### 3. **Você ativou as notificações?**

1. Acesse a página **Configurações** (`/settings`)
2. Procure pelo card **"Notificações Push do Google"**
3. Clique em **"Ativar Notificações Push"**
4. **Permita** quando o navegador solicitar

### 4. **Service Worker registrado?**

Abra o Console do navegador (F12) e verifique se há mensagens:
- ✅ `Service Worker registrado`
- ✅ `Service Worker pronto`
- ✅ `Firebase inicializado no Service Worker`

Se não aparecer, verifique:
- O arquivo `public/firebase-messaging-sw.js` existe?
- Está usando HTTPS ou localhost? (Service Workers não funcionam em HTTP)

### 5. **Token FCM obtido?**

No Console do navegador, após ativar notificações, deve aparecer:
- ✅ `Token FCM obtido: [token longo]`
- ✅ `Token FCM salvo no banco de dados`

Se não aparecer, verifique:
- VAPID Key está correta no `.env`?
- Permissão de notificação foi concedida?

### 6. **Verificar no Banco de Dados**

No Supabase Dashboard:
1. Vá em **Table Editor**
2. Abra a tabela `push_subscriptions`
3. Verifique se há um registro com seu `user_id` e um `fcm_token`

Se não houver registro, o token não foi salvo. Verifique o console para erros.

## 🧪 Testar Notificações

### Opção 1: Via Firebase Console (Mais Fácil)

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto **notifica-6e935**
3. Vá em **Cloud Messaging** (no menu lateral)
4. Clique em **Nova campanha**
5. Selecione **Notificação**
6. Preencha:
   - **Título:** Teste
   - **Texto:** Esta é uma notificação de teste
7. Clique em **Avançar**
8. Em **Destinatários**, selecione **App web**
9. Clique em **Enviar**

### Opção 2: Via Código

```typescript
import { sendPushNotification } from '@/lib/pushNotification';

// Enviar push para você mesmo
await sendPushNotification('seu-user-id', {
  title: 'Teste',
  body: 'Esta é uma notificação de teste',
  url: '/dashboard'
});
```

## 🐛 Problemas Comuns

### "Firebase não está configurado"
- ✅ Verifique se o `.env` existe e tem todas as variáveis
- ✅ Reinicie o servidor após criar/editar `.env`

### "VAPID Key não configurada"
- ✅ Verifique se `VITE_FIREBASE_VAPID_KEY` está no `.env`
- ✅ A VAPID Key deve ser: `BP_5hFuOqmqyWQhYdjVKHE98UYEkPjDmBXM69swNHCksU8CmK9TkPjMZuNtRVyqVxXRprDaQGw0Hao60PuGbh98`

### "Tabela push_subscriptions não existe"
- ✅ Execute a migration SQL no Supabase
- ✅ Verifique se a tabela foi criada no Table Editor

### "Permissão negada"
- ✅ Acesse as configurações do navegador
- ✅ Procure por "Notificações" ou "Site settings"
- ✅ Permita notificações para o seu site

### "Service Worker não registrado"
- ✅ Verifique se está usando HTTPS ou localhost
- ✅ Service Workers não funcionam em HTTP comum
- ✅ Verifique o console para erros

### "Token não foi salvo"
- ✅ Verifique o console do navegador para erros
- ✅ Verifique se a tabela `push_subscriptions` existe
- ✅ Verifique se você está autenticado (user.id existe)

### "Notificações não aparecem mesmo com tudo configurado"
- ⚠️ **Edge Function não configurada!** 
- As notificações push só funcionam se você configurar a Edge Function do Supabase
- Veja `CONFIGURAR_EDGE_FUNCTION.md` para instruções
- **OU** use o Firebase Console para enviar notificações de teste

## 📊 Verificar Status

Abra o Console do navegador (F12) e execute:

```javascript
// Verificar se Firebase está configurado
console.log('Firebase config:', {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '✅' : '❌',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅' : '❌',
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅' : '❌'
});

// Verificar Service Worker
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers registrados:', regs.length);
  regs.forEach(reg => console.log('SW:', reg.scope));
});

// Verificar permissão
console.log('Permissão de notificação:', Notification.permission);
```

## 🎯 Próximos Passos

1. ✅ Configure o `.env` (se ainda não fez)
2. ✅ Execute a migration SQL (se ainda não fez)
3. ✅ Acesse `/settings` e ative notificações
4. ✅ Teste enviando uma notificação via Firebase Console
5. ⚠️ Configure a Edge Function para enviar push automaticamente (opcional)

## 💡 Dica

**Para testar rapidamente:**
1. Ative as notificações em `/settings`
2. Vá no Firebase Console > Cloud Messaging > Nova campanha
3. Envie uma notificação de teste
4. Você deve receber mesmo com o site fechado!

---

**Ainda não funciona?** Verifique o console do navegador (F12) e compartilhe os erros que aparecem.

