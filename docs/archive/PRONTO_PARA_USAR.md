# ✅ Notificações Push - Pronto para Usar!

## 🎉 Configuração Completa

Todas as credenciais do Firebase foram configuradas! Agora você só precisa:

### 1. Criar arquivo `.env`

Crie um arquivo `.env` na **raiz do projeto** com este conteúdo:

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

**OU** copie o arquivo `.env.COMPLETO` para `.env`:

```bash
# Windows PowerShell
Copy-Item .env.COMPLETO .env

# Linux/Mac
cp .env.COMPLETO .env
```

### 2. Criar Tabela no Supabase

Execute a migration SQL no Supabase Dashboard:

1. Acesse o Supabase Dashboard
2. Vá em **SQL Editor**
3. Execute o conteúdo do arquivo:
   `supabase/migrations/20250122000000_create_push_subscriptions.sql`

### 3. Reiniciar o Servidor

```bash
npm run dev
```

### 4. Adicionar Componente

Adicione o componente de notificações em qualquer página:

```typescript
import { PushNotificationSetup } from '@/components/PushNotificationSetup';

// No Dashboard ou página de Configurações
<PushNotificationSetup />
```

## 🧪 Testar

1. Abra o site no navegador
2. Procure pelo componente de notificações push
3. Clique em **"Ativar Notificações Push"**
4. Permita as notificações quando o navegador solicitar
5. Verifique se o token foi salvo no banco (tabela `push_subscriptions`)

## 📤 Enviar Notificação de Teste

### Via Firebase Console:

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto **notifica-6e935**
3. Vá em **Cloud Messaging**
4. Clique em **Nova campanha**
5. Selecione **Notificação**
6. Preencha título e mensagem
7. Selecione o app web
8. Envie!

## ✅ Tudo Pronto!

Agora você pode:
- ✅ Receber notificações push mesmo com o site fechado
- ✅ Enviar notificações via Firebase Console
- ✅ Integrar com o sistema de notificações existente
- ✅ Enviar notificações programaticamente via backend

## 📚 Documentação

- `CONFIGURAR_FIREBASE_PUSH.md` - Guia completo
- `RESUMO_NOTIFICACOES_PUSH.md` - Resumo rápido
- `CONFIGURAR_ENV.md` - Configuração de variáveis

