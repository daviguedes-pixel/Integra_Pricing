# 🚀 Guia de Uso Rápido - Sistema de Segurança

## ⚡ Início Rápido

### 1. Deploy do Sistema
```powershell
# Deploy completo
.\deploy-security.ps1

# Deploy sem testes
.\deploy-security.ps1 -SkipTests
```

### 2. Usar o Cliente Seguro
```typescript
import { secureApiClient } from '@/lib/secure-api'

// Obter perfil do usuário
const profile = await secureApiClient.getProfile()

// Criar sugestão de preço
const suggestion = await secureApiClient.createSuggestion({
  station_id: 'station-123',
  client_id: 'client-456',
  product: 'gasolina_comum',
  payment_method_id: 'payment-789',
  cost_price: 4.50
})

// Buscar concorrentes
const competitors = await secureApiClient.getCompetitors('Shell')
```

### 3. Monitorar Segurança
```typescript
import { useSecurity } from '@/context/SecurityContext'

function MyComponent() {
  const { isSecure, securityScore, checkSecurity } = useSecurity()
  
  return (
    <div>
      <p>Seguro: {isSecure ? 'Sim' : 'Não'}</p>
      <p>Score: {securityScore}/100</p>
      <button onClick={checkSecurity}>Verificar</button>
    </div>
  )
}
```

## 🔧 Comandos Úteis

### Verificar Status
```bash
# Status das funções
supabase functions list

# Logs de uma função
supabase functions logs auth-api

# Estatísticas de segurança
npm run security-report
```

### Manutenção
```bash
# Limpar logs antigos
npm run cleanup-logs

# Verificar logs de auditoria
npm run check-security

# Backup manual
curl -X POST "https://ijygsxwfmribbjymxhaf.supabase.co/functions/v1/admin-api/api/admin/backup" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tables": ["user_profiles", "price_suggestions"]}'
```

## 📊 Endpoints Disponíveis

### Auth API
- `GET /api/auth/profile` - Perfil do usuário
- `POST /api/auth/refresh` - Renovar token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/permissions` - Permissões

### Pricing API
- `GET /api/pricing/suggestions` - Listar sugestões
- `POST /api/pricing/suggestions` - Criar sugestão
- `POST /api/pricing/approve` - Aprovar sugestão
- `GET /api/pricing/history` - Histórico
- `GET /api/pricing/cost` - Dados de custo

### Research API
- `GET /api/research/competitors` - Buscar concorrentes
- `POST /api/research/submit` - Enviar pesquisa
- `GET /api/research/history` - Histórico de pesquisas
- `GET /api/research/stations` - Buscar postos

### Admin API
- `GET /api/admin/users` - Listar usuários
- `PUT /api/admin/users` - Atualizar usuário
- `GET /api/admin/audit-logs` - Logs de auditoria
- `GET /api/admin/security-events` - Eventos de segurança
- `GET /api/admin/system-stats` - Estatísticas
- `POST /api/admin/backup` - Criar backup

## 🛡️ Recursos de Segurança

### Rate Limiting
- Auth API: 50 req/15min
- Pricing API: 100 req/15min
- Research API: 200 req/15min
- Admin API: 50 req/15min

### Validação de Dados
- Email com regex
- Telefone brasileiro (10-11 dígitos)
- Preços entre 0 e 999999.99
- CNPJ com dígitos verificadores

### Monitoramento
- Verificação automática a cada 5 minutos
- Logs de auditoria em tempo real
- Alertas para eventos críticos
- Dashboard de segurança

## 🚨 Troubleshooting

### Token Expirado
```typescript
// O cliente renova automaticamente
const response = await secureApiClient.getProfile()
if (!response.success && response.error.includes('expirado')) {
  // Token será renovado automaticamente na próxima requisição
}
```

### Rate Limit Excedido
```typescript
// Aguardar e tentar novamente
setTimeout(async () => {
  const response = await secureApiClient.getSuggestions()
}, 60000) // Aguardar 1 minuto
```

### Erro de Permissão
```typescript
// Verificar permissões do usuário
const permissions = await secureApiClient.getPermissions()
if (!permissions.data.pode_acessar_solicitacao) {
  console.log('Usuário sem permissão para solicitações')
}
```

## 📈 Monitoramento

### Dashboard de Segurança
```typescript
import { SecurityDashboard } from '@/components/SecurityDashboard'

// Usar o dashboard completo
<SecurityDashboard />

// Ou apenas o indicador
import { SecurityIndicator } from '@/components/SecurityDashboard'
<SecurityIndicator />
```

### Logs de Auditoria
```sql
-- Ver logs recentes
SELECT * FROM security_audit_log 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Eventos críticos
SELECT * FROM security_events 
WHERE severity IN ('high', 'critical')
AND resolved = false;
```

## 🔐 Configurações Avançadas

### JWT Secret Personalizado
```sql
ALTER DATABASE postgres SET app.jwt_secret = 'seu-secret-super-seguro';
```

### Rate Limiting Personalizado
```typescript
const customRateLimit = createRateLimitMiddleware(200, 30 * 60 * 1000) // 200 req/30min
```

### Headers de Segurança Adicionais
```typescript
const customHeaders = {
  'X-Custom-Security-Header': 'valor',
  'X-API-Version': '1.0'
}
```

---

**Sistema de Segurança Ativo! 🔒**

Para mais informações, consulte:
- `SECURITY_IMPLEMENTATION.md` - Documentação completa
- `security-config.json` - Configurações do sistema
- `security_report.md` - Relatório de deploy
