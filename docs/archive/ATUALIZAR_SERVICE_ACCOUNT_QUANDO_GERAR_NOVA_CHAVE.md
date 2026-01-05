# 🔄 Atualizar Service Account Quando Gerar Nova Chave

## ⚠️ IMPORTANTE: Quando você gera uma nova chave privada no Firebase

**A chave anterior é automaticamente invalidada!**

Isso significa que:
- ❌ O JSON antigo que está no Supabase **para de funcionar**
- ✅ Você precisa **atualizar** o secret no Supabase com o novo JSON
- ⚠️ Se você gerar uma nova chave sem atualizar no Supabase, vai dar erro 500

## 📋 Passo a Passo para Atualizar

### 1. Gerar Nova Chave no Firebase

1. Acesse: https://console.firebase.google.com/project/notifica-6e935/settings/serviceaccounts/adminsdk
2. Clique em **"Gerar nova chave privada"**
3. Confirme a ação
4. Um arquivo JSON será baixado automaticamente (ex: `notifica-6e935-xxxxx.json`)

### 2. Abrir o Arquivo JSON

1. Abra o arquivo JSON que foi baixado
2. **Copie TODO o conteúdo** (Ctrl+A, Ctrl+C)
3. O JSON deve começar com `{` e terminar com `}`

### 3. Atualizar no Supabase Dashboard

1. Acesse: **Supabase Dashboard** > **Edge Functions** > **Settings** > **Secrets**
2. Encontre o secret: `FIREBASE_SERVICE_ACCOUNT_JSON`
3. Clique em **Editar** (ou **Edit**)
4. **Apague** o conteúdo antigo
5. **Cole** o novo JSON completo
6. Clique em **Salvar** (ou **Save**)

### 4. Testar

1. Volte para `/settings` no seu app
2. Clique em **"Enviar Teste"**
3. Deve funcionar agora! ✅

## 🔍 Como Saber se Precisa Atualizar?

Se você está recebendo erro **500 (Internal Server Error)** e:
- ✅ Você já tinha configurado o Service Account antes
- ✅ Você gerou uma nova chave privada no Firebase
- ✅ O erro começou depois de gerar a nova chave

**Então você precisa atualizar o secret no Supabase!**

## 💡 Dica: Evitar Gerar Novas Chaves Desnecessariamente

- ✅ **Mantenha a mesma chave** se possível
- ✅ Só gere uma nova chave se:
  - Você perdeu a chave anterior
  - Você suspeita que a chave foi comprometida
  - Você precisa de uma nova chave por algum motivo específico

## ⚠️ Importante

- Cada vez que você gera uma nova chave, a anterior é invalidada
- Você pode ter **múltiplas chaves ativas** ao mesmo tempo
- Mas se você gerar uma nova e não atualizar no Supabase, vai dar erro
- O Service Account JSON em si **não expira**, mas quando você gera uma nova chave, a anterior para de funcionar

## ✅ Resumo

1. Gerou nova chave no Firebase? → Atualize no Supabase
2. Erro 500 após gerar nova chave? → Atualize no Supabase
3. Não está funcionando? → Verifique se o JSON está completo e correto

