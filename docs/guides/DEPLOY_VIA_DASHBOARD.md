# 🚀 Deploy da Edge Function via Dashboard (Sem CLI)

Como o login do CLI não está funcionando, você pode fazer o deploy diretamente pelo Dashboard do Supabase.

## 📋 Passo a Passo

### 1. Acessar Edge Functions no Dashboard

1. No **Supabase Dashboard**, vá em **Edge Functions** (menu lateral)
2. Se já existir a função `send-push-notification`, clique nela
3. Se não existir, clique em **"Create a new function"** ou **"Criar nova função"**

### 2. Criar/Editar a Função

**Nome da função:** `send-push-notification`

**Código da função:** Copie todo o conteúdo abaixo e cole no editor:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const FCM_V1_ENDPOINT = 'https://fcm.googleapis.com/v1/projects/notifica-6e935/messages:send';

interface PushRequest {
  token: string;
  notification: {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
  };
  data?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Obter dados da requisição
    const body: PushRequest = await req.json();
    const { token, notification, data } = body;

    // Validações
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token FCM é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!notification || !notification.title || !notification.body) {
      return new Response(
        JSON.stringify({ error: 'Título e corpo da notificação são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Obter Access Token do Firebase
    const accessToken = Deno.env.get('FIREBASE_ACCESS_TOKEN');
    
    if (!accessToken) {
      console.error('❌ FIREBASE_ACCESS_TOKEN não configurada');
      return new Response(
        JSON.stringify({ 
          error: 'Firebase Access Token não configurada',
          hint: 'Configure FIREBASE_ACCESS_TOKEN no Supabase Dashboard > Edge Functions > Settings'
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📤 Enviando push notification via FCM V1 API');

    // Enviar via FCM V1 API
    const fcmResponse = await fetch(FCM_V1_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: {
            ...data,
            url: data?.url || '/dashboard',
            tag: data?.tag || 'notification',
          },
          webpush: {
            notification: {
              title: notification.title,
              body: notification.body,
              icon: notification.icon || '/favicon.ico',
              badge: notification.badge || '/favicon.ico',
            },
            fcm_options: {
              link: data?.url || '/dashboard'
            }
          }
        }
      }),
    });

    if (!fcmResponse.ok) {
      const errorText = await fcmResponse.text();
      console.error('❌ Erro ao enviar push:', fcmResponse.status, errorText);
      
      return new Response(
        JSON.stringify({ 
          error: 'Erro ao enviar notificação push',
          details: errorText,
          status: fcmResponse.status
        }),
        { 
          status: fcmResponse.status, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const result = await fcmResponse.json();
    console.log('✅ Push enviado com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.name,
        result 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro ao processar requisição:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro desconhecido'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

### 3. Configurar Variável de Ambiente

1. No Dashboard, vá em **Edge Functions** > **Settings** (ou **Configurações**)
2. Procure por **Secrets** (ou **Variáveis de Ambiente**)
3. Clique em **"Add new secret"**
4. Adicione:
   - **Name:** `FIREBASE_ACCESS_TOKEN`
   - **Value:** Cole o Access Token que você obteve
5. Clique em **Save**

### 4. Fazer Deploy

1. No editor da função, clique em **"Deploy"** (ou **"Publicar"**)
2. Aguarde o deploy completar

## ✅ Pronto!

Agora teste:
- Clique em **"Enviar Teste"** em `/settings`
- Você deve receber a notificação push!

## 🐛 Problemas?

### "FIREBASE_ACCESS_TOKEN não configurada"
- Verifique se adicionou no Settings > Secrets
- Nome deve ser exatamente: `FIREBASE_ACCESS_TOKEN`

### "401 Unauthorized"
- O Access Token pode ter expirado (expira em 1 hora)
- Gere um novo token: `node get-firebase-token.js`
- Atualize no Dashboard

---

**Pronto!** Agora você pode fazer deploy sem precisar do CLI! 🎉

