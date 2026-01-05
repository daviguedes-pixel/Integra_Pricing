# 🔔 Como Configurar Notificações Push do Google (Firebase Cloud Messaging)

Este guia explica como configurar notificações push usando Firebase Cloud Messaging (FCM) do Google.

## 📋 Pré-requisitos

1. Conta no Google Firebase
2. Projeto criado no Firebase Console
3. Acesso ao Supabase para criar a tabela de tokens

## 🚀 Passo a Passo

### 1. Criar Projeto no Firebase

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Clique em "Adicionar projeto"
3. Preencha o nome do projeto e continue
4. Configure Google Analytics (opcional)
5. Clique em "Criar projeto"

### 2. Adicionar App Web ao Firebase

1. No painel do projeto, clique no ícone **Web** (`</>`)
2. Registre o app com um nome (ex: "Integra Portal")
3. **Copie as credenciais** que aparecem (você vai precisar delas)

### 3. Obter VAPID Key

1. No Firebase Console, vá em **Configurações do Projeto** (ícone de engrenagem)
2. Aba **Cloud Messaging**
3. Em **Web Push certificates**, clique em **Gerar novo par de chaves**
4. **Copie a chave** gerada (VAPID Key)

### 4. Configurar Variáveis de Ambiente

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=sua-api-key-aqui
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=seu-sender-id
VITE_FIREBASE_APP_ID=seu-app-id
VITE_FIREBASE_MEASUREMENT_ID=seu-measurement-id
VITE_FIREBASE_VAPID_KEY=sua-vapid-key-aqui
```

### 5. Atualizar Service Worker

Edite o arquivo `public/firebase-messaging-sw.js` e substitua as credenciais:

```javascript
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJECT_ID",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};
```

### 6. Criar Tabela no Supabase

Execute a migration SQL no Supabase:

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o arquivo `supabase/migrations/20250122000000_create_push_subscriptions.sql`

Ou execute diretamente:

```sql
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  fcm_token TEXT NOT NULL UNIQUE,
  device_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS e políticas (veja o arquivo completo)
```

### 7. Registrar Service Worker

O service worker será registrado automaticamente quando o usuário ativar as notificações.

## 📱 Como Usar

### No Código

```typescript
import { useFirebasePush } from '@/hooks/useFirebasePush';
import { PushNotificationSetup } from '@/components/PushNotificationSetup';

// Em qualquer componente
function MeuComponente() {
  const { requestToken, fcmToken, permission } = useFirebasePush();
  
  // Solicitar permissão
  const handleEnable = async () => {
    const token = await requestToken();
    if (token) {
      console.log('Token obtido:', token);
    }
  };
  
  return <PushNotificationSetup />;
}
```

### Adicionar ao Layout

Adicione o componente `PushNotificationSetup` em uma página de configurações ou no Dashboard:

```typescript
import { PushNotificationSetup } from '@/components/PushNotificationSetup';

// No Dashboard ou página de configurações
<PushNotificationSetup />
```

## 🔔 Enviar Notificações Push

### Opção 1: Via Firebase Console (Teste)

1. Acesse Firebase Console > Cloud Messaging
2. Clique em "Nova campanha"
3. Selecione "Notificação"
4. Preencha título e mensagem
5. Selecione o app web
6. Envie

### Opção 2: Via Backend (Produção)

Use a API do Firebase Admin SDK no backend para enviar notificações:

```javascript
// Exemplo Node.js
const admin = require('firebase-admin');

// Inicializar Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Enviar notificação
const message = {
  notification: {
    title: 'Nova Solicitação',
    body: 'Você tem uma nova solicitação de preço'
  },
  token: 'fcm-token-do-usuario',
  data: {
    url: '/approvals',
    suggestion_id: '123'
  }
};

admin.messaging().send(message);
```

### Opção 3: Integrar com Sistema de Notificações Existente

Modifique o sistema de notificações existente para também enviar push:

```typescript
// Quando criar uma notificação no banco
import { createNotification } from '@/lib/utils';
import { sendPushNotification } from '@/lib/push-sender'; // Criar esta função

// Criar notificação no banco
await createNotification(userId, 'approval_pending', 'Título', 'Mensagem');

// Enviar push também
const { data: subscription } = await supabase
  .from('push_subscriptions')
  .select('fcm_token')
  .eq('user_id', userId)
  .single();

if (subscription?.fcm_token) {
  await sendPushNotification(subscription.fcm_token, {
    title: 'Título',
    body: 'Mensagem',
    data: { url: '/approvals' }
  });
}
```

## ✅ Verificação

1. Abra o site
2. Clique em "Ativar Notificações Push"
3. Permita as notificações no navegador
4. Verifique se o token foi salvo no banco (tabela `push_subscriptions`)
5. Envie uma notificação de teste pelo Firebase Console

## 🐛 Troubleshooting

### "Firebase não está configurado"
- Verifique se todas as variáveis `VITE_FIREBASE_*` estão no `.env`
- Reinicie o servidor de desenvolvimento após adicionar variáveis

### "VAPID Key não configurada"
- Obtenha a VAPID Key no Firebase Console > Cloud Messaging
- Adicione `VITE_FIREBASE_VAPID_KEY` no `.env`

### "Service Worker não registrado"
- Verifique se o arquivo `public/firebase-messaging-sw.js` existe
- Verifique o console do navegador para erros
- Certifique-se de que está usando HTTPS (ou localhost)

### "Permissão negada"
- O usuário precisa permitir notificações nas configurações do navegador
- Alguns navegadores bloqueiam notificações em HTTP (precisa HTTPS)

## 📚 Recursos

- [Documentação Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Console](https://console.firebase.google.com/)
- [Web Push Notifications Guide](https://web.dev/push-notifications-overview/)

