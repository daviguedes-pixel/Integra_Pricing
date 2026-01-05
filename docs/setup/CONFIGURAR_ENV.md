# ⚙️ Configurar Variáveis de Ambiente

## 📝 Criar arquivo `.env`

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=AIzaSyDOWFfM7bePXhXTiR9T7auiBB8RSiF4jZs
VITE_FIREBASE_AUTH_DOMAIN=notifica-6e935.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=notifica-6e935
VITE_FIREBASE_STORAGE_BUCKET=notifica-6e935.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=201676842130
VITE_FIREBASE_APP_ID=1:201676842130:web:73a61de5dabf4a66e1324b
VITE_FIREBASE_MEASUREMENT_ID=G-04XHJMG4X1

# VAPID Key (já configurada)
VITE_FIREBASE_VAPID_KEY=BP_5hFuOqmqyWQhYdjVKHE98UYEkPjDmBXM69swNHCksU8CmK9TkPjMZuNtRVyqVxXRprDaQGw0Hao60PuGbh98
```

## 🔑 Como Obter a VAPID Key

1. Acesse o [Firebase Console](https://console.firebase.google.com/)
2. Selecione o projeto **notifica-6e935**
3. Clique no ícone de **engrenagem** (Configurações do Projeto)
4. Vá na aba **Cloud Messaging**
5. Na seção **Web Push certificates**, clique em **Gerar novo par de chaves**
6. **Copie a chave** gerada
7. Cole no arquivo `.env` na variável `VITE_FIREBASE_VAPID_KEY`

## ✅ Após Configurar

1. **Reinicie o servidor de desenvolvimento**:
   ```bash
   npm run dev
   ```

2. **Teste as notificações**:
   - Abra o site
   - Procure pelo componente de notificações push
   - Clique em "Ativar Notificações Push"
   - Permita as notificações no navegador

## 📚 Próximos Passos

- Execute a migration SQL para criar a tabela `push_subscriptions`
- Adicione o componente `<PushNotificationSetup />` em uma página
- Veja `CONFIGURAR_FIREBASE_PUSH.md` para mais detalhes

