# 🔍 Como Ver o Console do Service Worker

## 📋 Método 1: Via DevTools (Mais Fácil)

### Passo a Passo:

1. **Abra DevTools** (F12)

2. **Vá em Application** (ou "Aplicativo" em português)

3. **Clique em "Service Workers"** no menu lateral esquerdo

4. **Encontre o Service Worker:**
   - Procure por `firebase-messaging-sw.js`
   - Deve aparecer algo como: `http://localhost:8080/` ou `http://localhost:8080/firebase-cloud-messaging-push-scope`

5. **Para ver o console:**
   - **Opção A:** Clique no Service Worker e procure por um botão **"Console"** ou **"Inspect"**
   - **Opção B:** Clique com **botão direito** no Service Worker e escolha **"Inspect"** ou **"Inspect Service Worker"**
   - **Opção C:** Se houver um Service Worker "waiting", clique em **"skipWaiting"** para ativá-lo primeiro

6. **Uma nova janela/aba do DevTools vai abrir** com o console do Service Worker

## 📋 Método 2: Via Console Principal (Alternativa)

Se não conseguir abrir o console do Service Worker, você pode verificar os logs no console principal:

1. **Abra DevTools** (F12)
2. **Vá em Console** (aba principal)
3. **Filtre por "Service Worker"** ou procure por mensagens que começam com:
   - `📨 Mensagem recebida no Service Worker`
   - `✅ Firebase inicializado no Service Worker`
   - `📬 Mensagem recebida em background`

## 📋 Método 3: Verificar Status do Service Worker

1. **Application** > **Service Workers**
2. **Verifique o status:**
   - ✅ **"activated and is running"** = Funcionando
   - ⚠️ **"waiting to activate"** = Precisa ativar (clique em "skipWaiting")
   - ❌ **"redundant"** = Precisa recarregar

## 🔧 Se houver Service Worker "waiting":

1. Clique em **"skipWaiting"** no Service Worker que está "waiting"
2. **Recarregue a página** (Ctrl+Shift+R)
3. Teste novamente

## 💡 Dica:

Se não conseguir ver o console do Service Worker, você ainda pode:
1. Testar a notificação
2. **Minimizar a janela** imediatamente após clicar em "Testar"
3. A notificação deve aparecer se tudo estiver funcionando

---

**Tente o Método 1 primeiro!** Se não conseguir, use o Método 2 ou 3.

