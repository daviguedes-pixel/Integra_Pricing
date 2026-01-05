# Como Adicionar Notificações no Site

O sistema de notificações já está implementado e funcionando! Aqui estão as formas de adicionar notificações:

## 📋 Estrutura da Tabela

A tabela `notifications` tem os seguintes campos:
- `id` (UUID) - Gerado automaticamente
- `user_id` (UUID) - ID do usuário que receberá a notificação
- `type` (TEXT) - Tipo da notificação (veja tipos disponíveis abaixo)
- `title` (TEXT) - Título da notificação
- `message` (TEXT) - Mensagem da notificação
- `read` (BOOLEAN) - Se foi lida ou não (padrão: false)
- `data` (JSONB) - Dados adicionais opcionais
- `expires_at` (TIMESTAMP) - Data de expiração opcional
- `created_at` (TIMESTAMP) - Gerado automaticamente

## 🎯 Tipos de Notificação Disponíveis

- `rate_expiry` - Taxa vencendo
- `approval_pending` - Aprovação pendente
- `price_approved` - Preço aprovado
- `price_rejected` - Preço rejeitado
- `system` - Notificação do sistema
- `competitor_update` - Atualização de concorrente
- `client_update` - Atualização de cliente

## 📝 Formas de Adicionar Notificações

### 1. **Usando a Função Helper (Mais Fácil - RECOMENDADO)**

```typescript
import { createNotification, createNotificationForUsers } from '@/lib/utils';

// Notificar um usuário específico
await createNotification(
  userId,
  'system',
  'Título da Notificação',
  'Mensagem da notificação',
  { extra_data: 'valor' }, // dados opcionais
  new Date('2025-12-31') // expiração opcional
);

// Notificar múltiplos usuários
const userIds = ['user-id-1', 'user-id-2', 'user-id-3'];
await createNotificationForUsers(
  userIds,
  'approval_pending',
  'Nova Solicitação',
  'Há uma nova solicitação aguardando aprovação'
);
```

### 2. **Inserção Direta no Banco**

```typescript
import { supabase } from '@/integrations/supabase/client';

// Exemplo básico
const criarNotificacao = async (userId: string, titulo: string, mensagem: string) => {
  const { data, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'system',
      title: titulo,
      message: mensagem,
      read: false
    });

  if (error) {
    console.error('Erro ao criar notificação:', error);
  }
};
```

### 3. **Usando a Função SQL `create_notification`**

```typescript
import { supabase } from '@/integrations/supabase/client';

const criarNotificacao = async (
  userId: string,
  tipo: string,
  titulo: string,
  mensagem: string,
  dadosExtras?: any
) => {
  const { data, error } = await supabase.rpc('create_notification', {
    p_user_id: userId,
    p_type: tipo,
    p_title: titulo,
    p_message: mensagem,
    p_data: dadosExtras ? JSON.stringify(dadosExtras) : null,
    p_expires_at: null // ou uma data de expiração
  });

  if (error) {
    console.error('Erro ao criar notificação:', error);
  }
};
```

### 4. **Exemplo Prático: Notificar quando uma solicitação é criada**

```typescript
// No arquivo onde você cria uma solicitação (ex: PriceRequest.tsx)
const { user } = useAuth();

// Após criar a solicitação com sucesso
const { data: suggestion, error } = await supabase
  .from('price_suggestions')
  .insert([suggestionData])
  .select()
  .single();

if (!error && suggestion) {
  // Criar notificação para os aprovadores
  const { data: approvers } = await supabase
    .from('user_profiles')
    .select('user_id')
    .or('role.eq.admin,role.eq.supervisor,pode_acessar_aprovacao.eq.true');

  if (approvers) {
    for (const approver of approvers) {
      await supabase.from('notifications').insert({
        user_id: approver.user_id,
        type: 'approval_pending',
        title: 'Nova Solicitação de Preço',
        message: `Nova solicitação de preço criada por ${user?.email}`,
        data: {
          suggestion_id: suggestion.id,
          created_by: user?.id
        }
      });
    }
  }
}
```

### 5. **Exemplo: Notificar múltiplos usuários (usando helper)**

```typescript
// Usando a função helper (mais fácil)
import { createNotificationForUsers } from '@/lib/utils';

const notificarTodosAprovadores = async (titulo: string, mensagem: string) => {
  // Buscar todos os aprovadores
  const { data: approvers } = await supabase
    .from('user_profiles')
    .select('user_id')
    .or('role.eq.admin,role.eq.supervisor,pode_acessar_aprovacao.eq.true');

  if (approvers && approvers.length > 0) {
    const userIds = approvers.map(a => a.user_id);
    await createNotificationForUsers(
      userIds,
      'approval_pending',
      titulo,
      mensagem
    );
  }
};
```

### 6. **Exemplo: Notificar quando algo é atualizado**

```typescript
// Exemplo: Notificar quando um cliente é atualizado
const atualizarCliente = async (clientId: string, novosDados: any) => {
  const { error } = await supabase
    .from('clients')
    .update(novosDados)
    .eq('id', clientId);

  if (!error) {
    // Notificar usuários relevantes
    const { data: users } = await supabase
      .from('user_profiles')
      .select('user_id')
      .eq('role', 'admin');

    if (users) {
      const notifications = users.map(u => ({
        user_id: u.user_id,
        type: 'client_update',
        title: 'Cliente Atualizado',
        message: `O cliente ${novosDados.name} foi atualizado`,
        data: { client_id: clientId }
      }));

      await supabase.from('notifications').insert(notifications);
    }
  }
};
```

## 🔔 Como Funciona

1. **Notificações aparecem automaticamente** quando inseridas no banco
2. **Toast aparece** quando uma nova notificação é criada (via RealtimeNotifications)
3. **Ícone de sino** no header mostra o contador de não lidas
4. **Centro de notificações** abre ao clicar no sino

## 📍 Onde as Notificações Aparecem

- **Toast popup** (canto da tela) - aparece automaticamente
- **Ícone de sino** no header (com contador)
- **Centro de notificações** (ao clicar no sino)

## 💡 Dicas

- Use `data` (JSONB) para armazenar informações extras (IDs, links, etc.)
- Use `expires_at` para notificações temporárias
- O sistema já tem funções prontas: `notify_price_approved`, `notify_price_rejected`
- Notificações são atualizadas em tempo real via Supabase Realtime

## 🎨 Personalização

Os ícones e cores são definidos em `NotificationCenter.tsx` baseados no `type`:
- `rate_expiry` → 🕐 Laranja
- `approval_pending` → ⚠️ Amarelo
- `price_approved` → ✅ Verde
- `price_rejected` → ❌ Vermelho
- `system` → ℹ️ Azul

