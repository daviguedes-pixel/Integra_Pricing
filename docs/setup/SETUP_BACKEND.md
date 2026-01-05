# 🔒 Configuração Backend - Guia Completo

## ⚠️ IMPORTANTE: Migração de Segurança

Este projeto agora usa um backend seguro que gerencia todas as autenticações e operações sensíveis.

## 📋 Problemas de Segurança Corrigidos

### ❌ ANTES (Inseguro)
- Credenciais do Supabase hardcoded no frontend
- Service Role Key exposta no código
- Sem controle de autenticação centralizado
- Vulnerável a ataques e manipulação

### ✅ AGORA (Seguro)
- ✅ Credenciais movidas para variáveis de ambiente
- ✅ Service Role Key apenas no backend (nunca exposta)
- ✅ Autenticação JWT com tokens seguros
- ✅ Cookies HTTP-only para armazenamento
- ✅ Rate limiting aplicado
- ✅ Headers de segurança configurados

## 🚀 Instalação e Configuração

### Passo 1: Instalar dependências do backend

```bash
# Na raiz do projeto
npm run backend:install
```

### Passo 2: Configurar variáveis de ambiente do backend

Crie o arquivo `server/.env` baseado no `server/env.example.txt`:

```bash
cd server
copy env.example.txt .env
```

Edite o arquivo `server/.env` e configure:

```env
# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# ⚠️ MUDE ESSAS CHAVES EM PRODUÇÃO!
JWT_SECRET=sua-chave-secreta-muito-forte-aqui
JWT_REFRESH_SECRET=sua-chave-refresh-muito-forte-aqui

# Supabase Configuration (OBTENHA DO DASHBOARD DO SUPABASE)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key-do-supabase
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key-do-supabase
```

### Passo 3: Configurar variáveis de ambiente do frontend

Crie o arquivo `.env` na raiz do projeto:

```env
VITE_API_URL=http://localhost:3001
```

**OU** você pode usar o backend diretamente sem configurar, mas precisará atualizar os componentes:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-do-supabase
```

### Passo 4: Executar o projeto

#### Opção 1: Executar tudo junto (recomendado)
```bash
# Na raiz do projeto
npm install concurrently  # Se ainda não instalou
npm run dev:full
```

Isso inicia o backend e frontend simultaneamente.

#### Opção 2: Executar em terminais separados

**Terminal 1 - Backend:**
```bash
npm run backend:dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

## 🔑 Onde Obter as Credenciais do Supabase

1. Acesse seu projeto no [Supabase Dashboard](https://app.supabase.com)
2. Vá em **Settings** → **API**
3. Copie:
   - **URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role secret** → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ CUIDADO: Esta é a mais sensível!

## 📁 Estrutura Criada

```
.
├── server/                          # Novo backend
│   ├── src/
│   │   ├── config/
│   │   │   └── supabase.ts         # Config Supabase
│   │   ├── controllers/
│   │   │   ├── authController.ts
│   │   │   └── dataController.ts
│   │   ├── middleware/
│   │   │   └── auth.ts             # Middleware JWT
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   └── data.ts
│   │   └── index.ts                 # Servidor Express
│   ├── .env                         # ⚠️ NÃO COMITAR!
│   ├── package.json
│   └── tsconfig.json
├── src/
│   ├── lib/
│   │   └── api.ts                   # Cliente API (NOVO)
│   └── hooks/
│       └── useApiAuth.ts            # Hook autenticação (NOVO)
├── .env                             # Frontend env
└── README_BACKEND.md                # Documentação
```

## 🔐 Segurança Implementada

### 1. Autenticação JWT
```typescript
// Tokens JWT com expiração curta
accessToken: 15 minutos
refreshToken: 7 dias
```

### 2. Cookies HTTP-Only
```typescript
// Tokens armazenados em cookies seguros
res.cookie('accessToken', token, {
  httpOnly: true,      // Não acessível via JavaScript
  secure: true,        // Apenas HTTPS em produção
  sameSite: 'strict'   // Proteção CSRF
});
```

### 3. Middleware de Segurança
- **Helmet**: Headers de segurança HTTP
- **CORS**: Configuração restritiva
- **Rate Limiting**: 100 requisições por 15 minutos
- **Body Parser**: Limite de 10MB

### 4. Supabase Seguro
```typescript
// Backend (seguro)
const supabaseAdmin = createClient(URL, SERVICE_ROLE_KEY); ✅

// Frontend (deprecated)
const supabase = createClient(URL, ANON_KEY); ⚠️
```

## 📡 API Endpoints

### Autenticação
```
POST   /api/auth/signin      - Login
POST   /api/auth/signout     - Logout
POST   /api/auth/refresh     - Refresh token
GET    /api/auth/check      - Verificar auth
GET    /health               - Health check
```

### Dados (Protegidos - Requer JWT)
```
GET    /api/data/stations           - Listar estações
GET    /api/data/clients            - Listar clientes
GET    /api/data/payment-methods   - Métodos de pagamento
GET    /api/data/price-requests    - Solicitações de preço
POST   /api/data/price-requests    - Criar solicitação
```

## 🔄 Migração do Frontend

Os componentes que usam diretamente o Supabase precisam ser atualizados.

### Exemplo de Migração:

```typescript
// ❌ ANTIGO
import { supabase } from '@/integrations/supabase/client';
const { data } = await supabase.from('stations').select('*');

// ✅ NOVO
import { api } from '@/lib/api';
const { data } = await api.get('/api/data/stations');
```

### Autenticação:

```typescript
// ❌ ANTIGO
import { useAuth } from '@/hooks/useAuth';
const { signIn } = useAuth();

// ✅ NOVO
import { useApiAuth } from '@/hooks/useApiAuth';
const { signIn } = useApiAuth();
```

## ✅ Checklist de Configuração

- [ ] Backend instalado (`npm run backend:install`)
- [ ] Arquivo `server/.env` criado e configurado
- [ ] Credenciais do Supabase adicionadas
- [ ] Chaves JWT alteradas (não use as padrão!)
- [ ] Arquivo `.env` do frontend criado
- [ ] Servidor testado (`npm run backend:dev`)
- [ ] Health check funcionando (`curl http://localhost:3001/health`)

## 🚨 Próximos Passos

1. **Migrar componentes** para usar o backend API
2. **Remover uso direto** do Supabase no frontend
3. **Adicionar validação** de dados (Zod)
4. **Implementar logging** e monitoramento
5. **Adicionar testes** de segurança
6. **Configurar CI/CD** para deploy

## ⚠️ IMPORTANTE

- **NUNCA** commite o arquivo `server/.env`
- **NUNCA** exponha a Service Role Key no frontend
- **SEMPRE** use HTTPS em produção
- **MUDE** as chaves JWT padrão antes de colocar em produção

## 🐛 Troubleshooting

### Backend não inicia
```bash
cd server
npm install
npm run dev
```

### Erro de conexão Supabase
Verifique se as credenciais em `server/.env` estão corretas.

### CORS Error
Verifique se `FRONTEND_URL` no `server/.env` está correto.

### Porta 3001 já em uso
Mude a `PORT` no `server/.env`.

## 📞 Suporte

Em caso de problemas, verifique:
1. Todas as variáveis de ambiente estão configuradas
2. Backend está rodando (http://localhost:3001/health)
3. Dependências instaladas (`npm install` em ambos os diretórios)

---

**Por segurança, nunca commite credenciais! Use variáveis de ambiente.**
