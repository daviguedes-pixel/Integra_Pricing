# 🔧 Resolver: Notificação Não Aparece

## ✅ O que está funcionando:
- Edge Function executada com sucesso ✅
- Permissões do navegador ativas ✅
- Firebase inicializado ✅
- Service Worker registrado ✅

## ❌ Problema:
- Notificação não aparece no navegador ❌

## 🔍 Verificações:

### 1. Verificar Service Worker está recebendo mensagens

1. Abra **DevTools** (F12)
2. Vá em **Application** > **Service Workers**
3. Clique em **"Console"** ao lado do Service Worker `firebase-messaging-sw.js`
4. Clique em **"Testar Edge Function (Automático)"** novamente
5. **Procure por estas mensagens no console do Service Worker:**
   - `📬 Mensagem recebida em background:`
   - `🔔 Exibindo notificação:`
   - `✅ Notificação exibida com sucesso!`

**Me diga o que aparece no console do Service Worker!**

### 2. Testar com janela em background

**IMPORTANTE:** Notificações push só aparecem quando:
- A janela do navegador está **minimizada** OU
- Você está em **outra aba** OU
- O navegador está em **segundo plano**

**Teste:**
1. Clique em **"Testar Edge Function (Automático)"**
2. **Imediatamente minimize a janela** (ou mude para outra aba)
3. A notificação deve aparecer

### 3. Verificar se notificação aparece quando app está em primeiro plano

Quando o app está em primeiro plano, a notificação pode aparecer como **toast** ao invés de notificação do sistema.

**Verifique:**
- Apareceu algum **toast** na tela?
- Apareceu alguma mensagem no canto da tela?

### 4. Verificar logs da Edge Function

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification** > **Logs**
2. Procure por:
   - `✅ Push enviado com sucesso`
   - `📝 Message ID:`
3. Veja se há algum erro

## 🐛 Problemas Comuns:

### Service Worker não recebe mensagens

**Sintoma:** Nenhuma mensagem no console do Service Worker

**Solução:**
1. Desregistre o Service Worker: **Application** > **Service Workers** > **Unregister**
2. Recarregue a página (Ctrl+Shift+R)
3. Teste novamente

### Notificação só aparece em background

**Isso é normal!** Notificações push do Firebase só aparecem quando o app está em background.

**Teste:**
1. Clique em "Testar Edge Function (Automático)"
2. Minimize a janela imediatamente
3. A notificação deve aparecer

### Permissões bloqueadas

**Sintoma:** Service Worker recebe mensagem mas notificação não aparece

**Solução:**
1. Verifique permissões: ícone de cadeado > Notificações > Permitir
2. Recarregue a página

## 📋 Checklist:

- [ ] Service Worker está ativo?
- [ ] Console do Service Worker mostra mensagens?
- [ ] Testou com janela minimizada?
- [ ] Permissões estão ativas?
- [ ] Edge Function retornou sucesso?

---

**Me diga:**
1. O que aparece no console do Service Worker quando você testa?
2. Você testou com a janela minimizada?
3. Apareceu algum toast na tela?

