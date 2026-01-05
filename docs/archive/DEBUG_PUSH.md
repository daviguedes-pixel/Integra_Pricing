# 🐛 Debug: Notificações Push

## 📋 Checklist de Debug

Siga estes passos para identificar o problema:

### 1. Abra o Console do Navegador (F12)

### 2. Verifique se aparecem estas mensagens:

#### Ao carregar a página:
- ✅ `Service Worker registrado: [URL]`
- ✅ `Service Worker pronto`
- ✅ `🔍 Verificando suporte para notificações push...`
- ✅ `✅ Navegador suporta notificações`
- ✅ `🔧 Inicializando Firebase...`
- ✅ `✅ Firebase Messaging disponível`

#### No Service Worker (aba "Service Workers" no DevTools):
- ✅ `📨 Mensagem recebida no Service Worker: {type: "FIREBASE_CONFIG"}`
- ✅ `🔧 Configuração do Firebase recebida no Service Worker`
- ✅ `🚀 Inicializando Firebase no Service Worker...`
- ✅ `✅ Firebase inicializado no Service Worker`

#### Ao clicar em "Ativar Notificações Push":
- ✅ `🔔 Iniciando solicitação de permissão de notificação...`
- ✅ `✅ Firebase Messaging inicializado`
- ✅ `📱 Solicitando permissão do navegador...`
- ✅ `📱 Permissão: granted`
- ✅ `✅ Permissão concedida`
- ✅ `🔑 VAPID Key encontrada, obtendo token FCM...`
- ✅ `✅ Token FCM obtido: [token]`
- ✅ `💾 Salvando token FCM no banco de dados...`
- ✅ `✅ Token FCM salvo no banco de dados`

## ❌ Problemas Comuns

### Se não aparecer "Service Worker registrado":
- Verifique se está usando HTTPS ou localhost
- Service Workers não funcionam em HTTP comum
- Verifique se o arquivo `public/firebase-messaging-sw.js` existe

### Se não aparecer "Firebase Messaging disponível":
- Verifique o arquivo `.env` na raiz do projeto
- Verifique se todas as variáveis `VITE_FIREBASE_*` estão configuradas
- **REINICIE o servidor** após criar/editar o `.env`

### Se não aparecer "Firebase inicializado no Service Worker":
- O service worker pode não ter recebido a mensagem
- Tente recarregar a página (Ctrl+Shift+R para forçar recarregamento)
- Verifique a aba "Service Workers" no DevTools

### Se não aparecer "Token FCM obtido":
- Verifique se a VAPID Key está correta no `.env`
- Verifique se você permitiu as notificações no navegador
- Verifique o console para erros específicos

### Se não aparecer "Token FCM salvo no banco de dados":
- Verifique se a tabela `push_subscriptions` existe no Supabase
- Execute a migration SQL se necessário
- Verifique o console para erros de banco de dados

## 🔍 Verificar Manualmente

### Verificar Service Worker:
1. Abra DevTools (F12)
2. Vá na aba "Application" (Chrome) ou "Storage" (Firefox)
3. Clique em "Service Workers"
4. Deve aparecer `firebase-messaging-sw.js` registrado

### Verificar Variáveis de Ambiente:
No console do navegador, execute:
```javascript
console.log({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? '✅' : '❌',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? '✅' : '❌',
  vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY ? '✅' : '❌'
});
```

### Verificar Permissão:
No console do navegador, execute:
```javascript
console.log('Permissão:', Notification.permission);
```

### Verificar Service Worker Registrado:
No console do navegador, execute:
```javascript
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service Workers:', regs.length);
  regs.forEach(r => console.log('SW:', r.scope, r.active?.state));
});
```

## 📝 Compartilhar Debug

Se ainda não funcionar, compartilhe:
1. Todas as mensagens do console (copie e cole)
2. Qual navegador está usando
3. Se está usando HTTPS ou localhost
4. Se o arquivo `.env` existe e está configurado
5. Se a tabela `push_subscriptions` existe no Supabase

