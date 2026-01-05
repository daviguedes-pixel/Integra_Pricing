# 🔔 Teste de Notificação Push - Passo a Passo

## ⚠️ IMPORTANTE: Notificações Push só aparecem quando:

1. ✅ A janela do navegador está **minimizada** OU
2. ✅ Você está em **outra aba** OU  
3. ✅ O navegador está em **segundo plano**

**Quando o app está em primeiro plano, a notificação pode aparecer como toast, mas não como notificação do sistema.**

## 📋 Passo a Passo para Testar:

### 1. Abrir DevTools do Service Worker

1. Abra **DevTools** (F12)
2. Vá em **Application** > **Service Workers**
3. Encontre `firebase-messaging-sw.js`
4. Clique em **"Console"** ao lado do Service Worker
5. **MANTENHA ESTE CONSOLE ABERTO** para ver os logs

### 2. Testar Notificação

1. Na página `/settings`, clique em **"Testar Edge Function (Automático)"**
2. **IMEDIATAMENTE minimize a janela** (ou mude para outra aba)
3. **Observe o console do Service Worker** - deve aparecer:
   ```
   📬 ===== MENSAGEM RECEBIDA NO SERVICE WORKER =====
   🔔 Tentando exibir notificação...
   ✅✅✅ NOTIFICAÇÃO EXIBIDA COM SUCESSO! ✅✅✅
   ```
4. **A notificação deve aparecer** no sistema operacional

### 3. Se não aparecer, verificar:

#### A. Service Worker está ativo?
- **Application** > **Service Workers**
- Deve estar "activated and is running"
- Se não estiver, clique em **"Unregister"** e recarregue a página

#### B. Permissões estão ativas?
- Clique no ícone de **cadeado** na barra de endereços
- Verifique se **"Notificações"** está como **"Permitir"**

#### C. Console do Service Worker mostra mensagens?
- Se **NÃO aparecer** `📬 MENSAGEM RECEBIDA`, o problema é que o Service Worker não está recebendo
- Se **APARECER** mas não exibir notificação, o problema é na exibição

#### D. Testar com janela minimizada?
- **CRÍTICO:** Notificações push só aparecem quando a janela está em background
- Teste minimizando a janela ANTES de clicar no botão

## 🐛 Debug:

### Se o console do Service Worker NÃO mostra mensagens:

1. **Service Worker não está recebendo mensagens**
2. **Possíveis causas:**
   - Service Worker não está ativo
   - Firebase não foi inicializado no Service Worker
   - Token FCM inválido

**Solução:**
1. Desregistre o Service Worker
2. Recarregue a página
3. Verifique se aparece `✅ Firebase inicializado no Service Worker`
4. Teste novamente

### Se o console mostra mensagens mas notificação não aparece:

1. **Problema na exibição da notificação**
2. **Possíveis causas:**
   - Permissões bloqueadas
   - Navegador bloqueando notificações
   - Erro ao exibir notificação

**Solução:**
1. Verifique permissões (ícone de cadeado)
2. Verifique se há erro no console do Service Worker
3. Tente em outro navegador (Chrome, Edge, Firefox)

## 📊 Checklist:

- [ ] Service Worker está ativo?
- [ ] Console do Service Worker está aberto?
- [ ] Testou com janela minimizada?
- [ ] Permissões estão ativas?
- [ ] Console do Service Worker mostra `📬 MENSAGEM RECEBIDA`?
- [ ] Console do Service Worker mostra `✅✅✅ NOTIFICAÇÃO EXIBIDA`?

---

**Execute o teste passo a passo acima e me diga:**
1. O que aparece no console do Service Worker?
2. Você testou com a janela minimizada?
3. A notificação apareceu?

