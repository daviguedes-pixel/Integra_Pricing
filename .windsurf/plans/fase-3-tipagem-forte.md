# Fase 3 - Tipagem Forte

Plano para remover `@ts-nocheck`, eliminar uso excessivo de `any`, e criar sistema de tipos centralizado para garantir type-safety em todo o projeto.

---

## 📊 Diagnóstico Atual (Atualizado 2026-02-02)

### ✅ `@ts-nocheck` Removidos
| Arquivo | Status |
|---------|--------|
| `pages/Approvals.tsx` | ✅ Tipado |
| `pages/Admin.tsx` | ✅ Removido anteriormente |
| `pages/ClientManagement.tsx` | ✅ Removido anteriormente |
| `pages/StationManagement.tsx` | ✅ Removido anteriormente |
| `pages/TaxManagement.tsx` | ✅ Removido anteriormente |
| `pages/Gestao.tsx` | ✅ Removido anteriormente |
| `context/SecurityContext.tsx` | ✅ Removido anteriormente |

### Uso de `any` (323 ocorrências em ~50 arquivos)
**Arquivos principais:**
- `Approvals.tsx` - 41 usos (reduzido de 59) 
- `PriceRequest.tsx` - ~58 usos
- `PriceHistory.tsx` - ~28 usos
- `useDatabase.ts` - ~13 usos

### Tipos Existentes (Atualizados)
```
src/types/
├── index.ts                 # Re-exports centralizados ✅
├── notification.ts          # NotificationRecord
├── payment.ts               # PaymentMethod (legacy)
├── price-suggestion.ts      # PriceSuggestion, EditRequestFormData
└── entities/
    ├── index.ts             # Re-exports ✅
    ├── approval.types.ts    # Approval, EnrichedApproval, BatchApprovalGroup, etc ✅
    ├── station.types.ts     # Station, StationWithPayments, PaymentMethod ✅
    ├── client.types.ts      # Client, ClientFilters ✅
    └── user.types.ts        # User, UserProfile, Permission ✅
```

---

## 🎯 Objetivos

1. ~~**Remover todos os `@ts-nocheck`** dos 7 arquivos~~ ✅ CONCLUÍDO
2. **Reduzir uso de `any`** de 346 para < 50 (em casos justificados) - Atual: 323
3. ~~**Consolidar tipos** em pasta `src/types/` organizada~~ ✅ CONCLUÍDO
4. **Tipar respostas de API** do Supabase - Em andamento
5. **Adicionar validação runtime** com Zod (opcional)

---

## 📁 Estrutura de Tipos (Implementada)

```
src/types/
├── index.ts                 # Re-exports centralizados ✅
├── entities/
│   ├── index.ts             ✅
│   ├── approval.types.ts    # EnrichedApproval, BatchApprovalGroup, ApprovalStats, etc ✅
│   ├── station.types.ts     # Station, PaymentMethod ✅
│   ├── client.types.ts      # Client ✅
│   └── user.types.ts        # User, UserProfile, Permission ✅
├── notification.ts          ✅
├── payment.ts               # Legacy (pode ser removido)
└── price-suggestion.ts      ✅
```

---

## 📋 Etapas de Implementação

### Etapa 3.1 - Consolidar Tipos Base ✅ CONCLUÍDO
- [x] Remover duplicata `suggestion.ts` vs `price-suggestion.ts`
- [x] Criar `src/types/entities/` com tipos canônicos
- [x] Criar `src/types/index.ts` com exports centralizados
- [x] Atualizar imports em arquivos existentes

### Etapa 3.2 - Tipar Camada de API (1 dia)
- [ ] Adicionar tipos de retorno em `approvalsApi.ts`
- [ ] Adicionar tipos de retorno em `priceRequestsApi.ts`
- [ ] Adicionar tipos em `stationsApi.ts` e `clientsApi.ts`
- [ ] Remover `as any` e `as unknown` onde possível

### Etapa 3.3 - Tipar Hooks (1 dia)
- [ ] `useDatabase.ts` - tipar retornos e estados
- [ ] `useAuth.tsx` - tipar User e Session
- [ ] `usePermissions.tsx` - tipar Permissions

### Etapa 3.4 - Remover @ts-nocheck (2-3 dias)
- [ ] `Approvals.tsx` - usar tipos de approval
- [ ] `PriceRequest.tsx` - usar tipos de price-request
- [ ] `Admin.tsx` - tipar users e permissions
- [ ] Demais 4 arquivos

### Etapa 3.5 - Validação Runtime (opcional)
- [ ] Instalar Zod
- [ ] Criar schemas para formulários
- [ ] Integrar com react-hook-form

---

## 🔧 Exemplo de Tipos Propostos

```typescript
// src/types/entities/approval.types.ts
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'price_suggested';
export type ProductType = 's10' | 's10_aditivado' | 'diesel_s500' | 'diesel_s500_aditivado' | 'arla32_granel';

export interface Approval {
  id: string;
  station_id: string;
  client_id: string;
  product: ProductType;
  status: ApprovalStatus;
  suggested_price: number;
  current_price?: number;
  purchase_cost?: number;
  freight_cost?: number;
  volume_made?: number;
  volume_projected?: number;
  observations?: string;
  requested_by: string;
  approved_by?: string;
  approved_at?: string;
  approval_level?: number;
  batch_id?: string;
  batch_name?: string;
  attachments?: string[];
  created_at: string;
  updated_at?: string;
}

export interface ApprovalWithRelations extends Approval {
  stations: { name: string; code?: string } | null;
  clients: { name: string } | null;
  requester: { name?: string; email?: string } | null;
}

export interface ApprovalFilters {
  status?: ApprovalStatus | 'all';
  product?: ProductType | 'all';
  requesterId?: string;
  startDate?: string;
  endDate?: string;
}
```

---

## ⚠️ Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Quebrar código existente | Manter `as any` temporariamente, remover gradualmente |
| Tipos do Supabase desatualizados | Regenerar com `supabase gen types typescript` |
| Muitas alterações simultâneas | Fazer por etapa, validar build a cada passo |

---

## ✅ Critérios de Sucesso

- [ ] Build TypeScript passa sem `--skipLibCheck`
- [ ] 0 arquivos com `@ts-nocheck`
- [ ] < 50 usos de `any` (documentados)
- [ ] Intellisense funcionando para todos os tipos
- [ ] Tipos exportados de `@/types`

---

## ⏱️ Estimativa Total: 5-7 dias

**Prioridade sugerida:** Alta - tipos fortes previnem bugs e melhoram DX
