# 🔍 Verificar Por Que Ainda Dá 404 Após Deploy

## ⚠️ Problema: 404 Persiste Após Deploy

Se você fez o deploy mas ainda recebe 404, siga estes passos de verificação:

## 📋 PASSO 1: Verificar se o Deploy Foi Bem-Sucedido

1. **Supabase Dashboard** > **Edge Functions** > **send-push-notification**
2. Verifique:
   - ✅ Status: **"Active"** ou **"Ativo"**
   - ✅ Último deploy: Data/hora recente
   - ✅ Não há erros de compilação

3. Se houver erro de deploy:
   - Veja a mensagem de erro
   - Verifique se o código está correto
   - Tente fazer deploy novamente

## 📋 PASSO 2: Aguardar Propagação (IMPORTANTE!)

Após o deploy, pode levar **2-5 minutos** para a função ficar acessível:

1. Aguarde 2-3 minutos após o deploy
2. Tente novamente
3. Se ainda não funcionar, continue para o próximo passo

## 📋 PASSO 3: Verificar Nome da Função

O nome da função **DEVE** ser exatamente: `send-push-notification`

- ✅ Correto: `send-push-notification`
- ❌ Errado: `send-push-notifications` (com 's')
- ❌ Errado: `Send-Push-Notification` (maiúsculas)
- ❌ Errado: `send_push_notification` (underscores)

**Verifique no Dashboard:**
- Edge Functions > lista de funções
- O nome deve ser exatamente `send-push-notification`

## 📋 PASSO 4: Testar Diretamente no Dashboard

1. **Edge Functions** > **send-push-notification** > **Invoke** (ou **"Invocar"**)
2. Cole este JSON:
   ```json
   {
     "token": "SEU-TOKEN-FCM-AQUI",
     "notification": {
       "title": "Teste",
       "body": "Testando notificação"
     },
     "data": {
       "url": "/dashboard"
     }
   }
   ```
3. Clique em **"Invoke"**
4. Veja o resultado:
   - ✅ **Se funcionar:** O problema é na chamada do frontend
   - ❌ **Se der 404:** A função não está deployada corretamente

## 📋 PASSO 5: Verificar URL da Função

A URL deve ser exatamente:
```
https://ijygsxwfmribbjymxhaf.supabase.co/functions/v1/send-push-notification
```

**Verifique:**
1. No Dashboard, veja a URL da função
2. Compare com a URL que está sendo chamada no console
3. Devem ser **idênticas**

## 📋 PASSO 6: Verificar Logs da Função

1. **Edge Functions** > **send-push-notification** > **Logs**
2. Veja se há:
   - ✅ Requisições chegando (mesmo que dêem erro)
   - ❌ Nenhuma requisição (significa que não está chegando)
   - ❌ Erros de compilação ou runtime

## 📋 PASSO 7: Deletar e Recriar a Função

Se nada funcionar, tente deletar e recriar:

1. **Edge Functions** > **send-push-notification** > **Delete** (ou **"Deletar"**)
2. Aguarde alguns segundos
3. **Edge Functions** > **"Deploy a new function"** (ou **"Criar nova função"**)
4. Nome: `send-push-notification`
5. Cole o código de: `supabase/functions/send-push-notification/index.ts`
6. Clique em **"Deploy"**
7. Aguarde 2-3 minutos
8. Teste novamente

## 📋 PASSO 8: Verificar Autenticação

O erro 404 pode ser causado por problema de autenticação:

1. Verifique se está logado no Supabase Dashboard
2. Verifique se o projeto está correto
3. Tente fazer logout e login novamente

## 🐛 Problemas Comuns

### "Function not found" mesmo após deploy
- ✅ Aguarde 2-5 minutos após o deploy
- ✅ Verifique se o nome está correto
- ✅ Tente deletar e recriar a função

### Deploy falha com erro
- ✅ Verifique se o código está completo
- ✅ Verifique se não há erros de sintaxe
- ✅ Tente fazer deploy novamente

### Função existe mas retorna 404
- ✅ Verifique se está ativa (Status: Active)
- ✅ Verifique os logs para ver se há erros
- ✅ Tente fazer um novo deploy

## ✅ Checklist Final

- [ ] Deploy foi bem-sucedido (sem erros)
- [ ] Aguardei 2-5 minutos após o deploy
- [ ] Nome da função está correto: `send-push-notification`
- [ ] Testei diretamente no Dashboard (Invoke)
- [ ] Verifiquei os logs da função
- [ ] URL está correta
- [ ] Tentei deletar e recriar a função

## 💡 Dica Importante

**Se ainda não funcionar após todos esses passos:**
1. Tire um screenshot do Dashboard mostrando a função
2. Tire um screenshot dos logs
3. Me envie essas informações para diagnóstico mais detalhado

---

**Lembre-se:** Após qualquer deploy, sempre aguarde 2-5 minutos antes de testar!

