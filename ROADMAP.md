# 🚀 Fuel Price Pro - Roadmap de Evolução

## Visão Geral
Plano estratégico para transformar o Fuel Price Pro em uma plataforma escalável, robusta e de alta performance.

---

## ✅ FASE 1 - Arquitetura Base (CONCLUÍDA)

### Objetivos
- [x] Modularização de componentes grandes
- [x] Lazy loading nas rotas
- [x] Separação de providers
- [x] Estrutura de pastas organizada

### Entregas
```
src/
├── app/
│   ├── providers/AppProviders.tsx
│   └── router/AppRoutes.tsx
├── components/
│   ├── ApprovalStats.tsx
│   ├── ApprovalsFiltersCard.tsx
│   ├── BatchApprovalHeader.tsx
│   ├── BatchRequestsMobileList.tsx
│   ├── PriceRequestStats.tsx
│   └── ProposalFullView.tsx
```

---

## 📦 FASE 2 - Camada de API Centralizada

### Objetivos
- [ ] Centralizar todas chamadas Supabase em `src/api/`
- [ ] Criar hooks de query com TanStack Query
- [ ] Implementar cache inteligente
- [ ] Padronizar tratamento de erros

### Estrutura Proposta
```
src/api/
├── index.ts                 # Exports centralizados
├── supabaseClient.ts        # Cliente configurado
├── approvals/
│   ├── approvalsApi.ts      # CRUD de aprovações
│   └── approvalsQueries.ts  # useQuery hooks
├── priceRequests/
│   ├── priceRequestsApi.ts
│   └── priceRequestsQueries.ts
├── stations/
├── clients/
└── users/
```

### Exemplo de Implementação
```typescript
// src/api/approvals/approvalsApi.ts
export const approvalsApi = {
  getAll: async (filters?: ApprovalFilters) => {...},
  getById: async (id: string) => {...},
  approve: async (id: string, data: ApproveData) => {...},
  reject: async (id: string, data: RejectData) => {...},
};

// src/api/approvals/approvalsQueries.ts
export const useApprovals = (filters?: ApprovalFilters) => {
  return useQuery({
    queryKey: ['approvals', filters],
    queryFn: () => approvalsApi.getAll(filters),
    staleTime: 5 * 60 * 1000,
  });
};
```

---

## 🔷 FASE 3 - Tipagem Forte

### Objetivos
- [ ] Remover todos `@ts-nocheck` e `any`
- [ ] Criar pasta `src/types/` com interfaces compartilhadas
- [ ] Tipar todas as respostas de API
- [ ] Usar Zod para validação runtime

### Estrutura Proposta
```
src/types/
├── index.ts
├── api.types.ts        # Respostas de API
├── database.types.ts   # Tipos do Supabase (gerado)
├── approval.types.ts
├── priceRequest.types.ts
├── station.types.ts
├── client.types.ts
└── user.types.ts
```

### Exemplo
```typescript
// src/types/approval.types.ts
export interface Approval {
  id: string;
  status: ApprovalStatus;
  station: Station;
  client: Client;
  product: ProductType;
  current_price: number;
  suggested_price: number;
  created_at: string;
  // ...
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'price_suggested';
export type ProductType = 's10' | 's10_aditivado' | 'diesel_s500' | 'diesel_s500_aditivado' | 'arla32_granel';
```

---

## 🗃️ FASE 4 - Estado Global com Zustand

### Objetivos
- [ ] Implementar Zustand para estado compartilhado
- [ ] Migrar contextos para stores
- [ ] Persistência de estado selecionado

### Estrutura Proposta
```
src/stores/
├── index.ts
├── useAuthStore.ts       # User, session
├── usePermissionsStore.ts
├── useUIStore.ts         # Theme, sidebar, modals
├── useFiltersStore.ts    # Filtros persistentes
└── useCacheStore.ts      # Cache local
```

### Exemplo
```typescript
// src/stores/useAuthStore.ts
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: true,
      signIn: async (email, password) => {...},
      signOut: async () => {...},
    }),
    { name: 'auth-storage' }
  )
);
```

---

## 🧪 FASE 5 - Testes Automatizados

### Objetivos
- [ ] Configurar Vitest + React Testing Library
- [ ] Testes unitários para hooks críticos
- [ ] Testes de componentes
- [ ] Testes de integração para fluxos principais

### Estrutura Proposta
```
src/
├── __tests__/
│   ├── setup.ts
│   └── utils.tsx          # Render helpers
├── hooks/
│   ├── useAuth.tsx
│   └── useAuth.test.tsx
├── components/
│   ├── ApprovalStats.tsx
│   └── ApprovalStats.test.tsx
```

### Cobertura Mínima Recomendada
- Hooks de autenticação: 90%
- Hooks de permissões: 90%
- Componentes de formulário: 80%
- Fluxos de aprovação: 85%

---

## ⚡ FASE 6 - Performance

### Objetivos
- [ ] Virtualização de listas (react-virtual)
- [ ] Otimização de re-renders (React.memo, useMemo)
- [ ] Code splitting avançado
- [ ] Otimização de imagens
- [ ] Prefetching de dados

### Técnicas
```typescript
// Virtualização de listas longas
import { useVirtualizer } from '@tanstack/react-virtual';

// Memoização de componentes pesados
const HeavyComponent = React.memo(({ data }) => {...});

// Prefetch de rotas
<Link to="/approvals" onMouseEnter={() => prefetchApprovals()}>
```

### Métricas Alvo
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3s
- Largest Contentful Paint: < 2.5s

---

## 📱 FASE 7 - PWA e Offline

### Objetivos
- [ ] Configurar Service Worker (Workbox)
- [ ] Cache de dados offline
- [ ] Sincronização em background
- [ ] Push notifications nativas
- [ ] Instalação como app

### Implementação
```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*supabase.*$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 100 },
            },
          },
        ],
      },
    }),
  ],
});
```

---

## 📊 FASE 8 - Monitoramento e Observabilidade

### Objetivos
- [ ] Error Boundary global
- [ ] Logging estruturado (Sentry ou similar)
- [ ] Analytics de uso
- [ ] Dashboards de métricas
- [ ] Alertas automáticos

### Implementação
```typescript
// src/components/ErrorBoundary.tsx
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: info });
  }
  // ...
}

// src/lib/analytics.ts
export const analytics = {
  track: (event: string, properties?: Record<string, any>) => {...},
  page: (name: string) => {...},
  identify: (userId: string, traits?: Record<string, any>) => {...},
};
```

---

## 🎯 Próximos Features (Backlog)

### Curto Prazo
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Notificações por email
- [ ] Dashboard de métricas de vendas
- [ ] Histórico de alterações de preços

### Médio Prazo
- [ ] Integração com ERPs
- [ ] API pública para parceiros
- [ ] Multi-tenancy (múltiplas empresas)
- [ ] Aplicativo mobile nativo

### Longo Prazo
- [ ] Machine Learning para sugestão de preços
- [ ] Previsão de demanda
- [ ] Análise de concorrência automatizada
- [ ] Marketplace de combustíveis

---

## 📅 Cronograma Sugerido

| Fase | Duração Estimada | Prioridade |
|------|------------------|------------|
| Fase 2 - API | 2-3 semanas | Alta |
| Fase 3 - Tipagem | 1-2 semanas | Alta |
| Fase 4 - Zustand | 1 semana | Média |
| Fase 5 - Testes | 2-3 semanas | Alta |
| Fase 6 - Performance | 1-2 semanas | Média |
| Fase 7 - PWA | 1-2 semanas | Média |
| Fase 8 - Monitoramento | 1 semana | Baixa |

---

## 🛠️ Stack Tecnológica

### Atual
- React 18 + TypeScript
- Vite
- TailwindCSS + shadcn/ui
- Supabase (Auth + Database)
- TanStack Query
- React Router v6

### Recomendado Adicionar
- Zustand (estado global)
- Zod (validação)
- Vitest + Testing Library (testes)
- Sentry (monitoramento)
- Workbox (PWA)

---

*Última atualização: Janeiro 2026*
