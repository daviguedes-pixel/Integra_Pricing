# 📱 Resumo: Notificações Push do Google (FCM)

## ✅ O que foi implementado

1. **Firebase SDK instalado** - `firebase` package
2. **Configuração do Firebase** - `src/lib/firebase.ts`
3. **Service Worker** - `public/firebase-messaging-sw.js`
4. **Hook personalizado** - `src/hooks/useFirebasePush.ts`
5. **Componente UI** - `src/components/PushNotificationSetup.tsx`
6. **Migration SQL** - `supabase/migrations/20250122000000_create_push_subscriptions.sql`
7. **Registro automático** - Service worker registrado em `src/main.tsx`

## 🚀 Próximos Passos

### 1. Configurar Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
2. Adicione um app Web
3. Obtenha as credenciais e VAPID Key
4. Adicione no `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_VAPID_KEY=...
```

### 2. Criar Tabela no Supabase

Execute a migration SQL:
- `supabase/migrations/20250122000000_create_push_subscriptions.sql`

Ou no Supabase Dashboard > SQL Editor, execute o SQL do arquivo.

### 3. Adicionar Componente em Alguma Página

```typescript
import { PushNotificationSetup } from '@/components/PushNotificationSetup';

// No Dashboard ou página de Configurações
<PushNotificationSetup />
```

### 4. Enviar Notificações

**Opção A: Via Firebase Console (Teste)**
- Firebase Console > Cloud Messaging > Nova campanha

**Opção B: Via Backend (Produção)**
- Use Firebase Admin SDK para enviar notificações programaticamente
- Integre com o sistema de notificações existente

## 📚 Arquivos Criados

- ✅ `src/lib/firebase.ts` - Configuração e inicialização do Firebase
- ✅ `src/hooks/useFirebasePush.ts` - Hook para gerenciar notificações push
- ✅ `src/components/PushNotificationSetup.tsx` - Componente UI
- ✅ `public/firebase-messaging-sw.js` - Service Worker
- ✅ `src/lib/registerServiceWorker.ts` - Registro do SW
- ✅ `supabase/migrations/20250122000000_create_push_subscriptions.sql` - Tabela de tokens
- ✅ `CONFIGURAR_FIREBASE_PUSH.md` - Guia completo de configuração

## 🔍 Como Funciona

1. **Usuário ativa notificações** → Solicita permissão do navegador
2. **Firebase gera token FCM** → Token único para o dispositivo
3. **Token é salvo no banco** → Tabela `push_subscriptions`
4. **Notificações são enviadas** → Via Firebase Console ou Admin SDK
5. **Service Worker recebe** → Mostra notificação mesmo com site fechado

## 💡 Exemplo de Uso

```typescript
import { useFirebasePush } from '@/hooks/useFirebasePush';

function MeuComponente() {
  const { requestToken, fcmToken, permission } = useFirebasePush();
  
  // Token já está salvo automaticamente quando obtido
  // Use fcmToken para enviar notificações específicas
}
```

## ⚠️ Importante

- **HTTPS obrigatório** em produção (ou localhost para desenvolvimento)
- **VAPID Key necessária** para funcionar
- **Permissão do usuário** é necessária
- **Service Worker** deve estar registrado

## 📖 Documentação

Veja `CONFIGURAR_FIREBASE_PUSH.md` para o guia completo passo a passo.

