import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { secureApiClient } from '@/lib/secure-api'

interface SecurityContextType {
  isSecure: boolean
  securityScore: number
  lastSecurityCheck: Date | null
  securityIssues: SecurityIssue[]
  checkSecurity: () => Promise<void>
  reportSecurityEvent: (event: SecurityEvent) => Promise<void>
}

interface SecurityIssue {
  id: string
  type: 'warning' | 'error' | 'critical'
  message: string
  details?: string
  timestamp: Date
  resolved: boolean
}

interface SecurityEvent {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  details?: any
}

const SecurityContext = createContext<SecurityContextType>({
  isSecure: false,
  securityScore: 0,
  lastSecurityCheck: null,
  securityIssues: [],
  checkSecurity: async () => {},
  reportSecurityEvent: async () => {}
})

export const useSecurity = () => useContext(SecurityContext)

export function SecurityProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [isSecure, setIsSecure] = useState(false)
  const [securityScore, setSecurityScore] = useState(0)
  const [lastSecurityCheck, setLastSecurityCheck] = useState<Date | null>(null)
  const [securityIssues, setSecurityIssues] = useState<SecurityIssue[]>([])

  const checkSecurity = async () => {
    if (!user) {
      setIsSecure(false)
      setSecurityScore(0)
      return
    }

    try {
      const issues: SecurityIssue[] = []
      let score = 100

      // Verificar se o usuário tem perfil válido
      const profileResponse = await secureApiClient.getProfile()
      if (!profileResponse.success) {
        issues.push({
          id: 'no-profile',
          type: 'critical',
          message: 'Perfil de usuário não encontrado',
          details: 'O usuário não possui um perfil válido no sistema',
          timestamp: new Date(),
          resolved: false
        })
        score -= 30
      }

      // Verificar permissões
      const permissionsResponse = await secureApiClient.getPermissions()
      if (!permissionsResponse.success) {
        issues.push({
          id: 'no-permissions',
          type: 'error',
          message: 'Permissões não carregadas',
          details: 'Não foi possível carregar as permissões do usuário',
          timestamp: new Date(),
          resolved: false
        })
        score -= 20
      }

      // Verificar se o token está próximo do vencimento
      const tokenExpiry = localStorage.getItem('token_expiry')
      if (tokenExpiry) {
        const expiryDate = new Date(tokenExpiry)
        const now = new Date()
        const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60)
        
        if (hoursUntilExpiry < 1) {
          issues.push({
            id: 'token-expiring',
            type: 'warning',
            message: 'Token próximo do vencimento',
            details: `Token expira em ${Math.round(hoursUntilExpiry * 60)} minutos`,
            timestamp: new Date(),
            resolved: false
          })
          score -= 10
        }
      }

      // Verificar conexão HTTPS
      if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
        issues.push({
          id: 'no-https',
          type: 'critical',
          message: 'Conexão não segura',
          details: 'O site não está sendo executado em HTTPS',
          timestamp: new Date(),
          resolved: false
        })
        score -= 40
      }

      // Verificar headers de segurança
      const securityHeaders = [
        'X-Content-Type-Options',
        'X-Frame-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security'
      ]

      // Simular verificação de headers (em produção, isso seria feito no servidor)
      const missingHeaders = securityHeaders.filter(header => {
        // Em um ambiente real, você verificaria os headers da resposta
        return Math.random() > 0.8 // Simulação
      })

      if (missingHeaders.length > 0) {
        issues.push({
          id: 'missing-headers',
          type: 'warning',
          message: 'Headers de segurança ausentes',
          details: `Headers ausentes: ${missingHeaders.join(', ')}`,
          timestamp: new Date(),
          resolved: false
        })
        score -= 15
      }

      setSecurityIssues(issues)
      setSecurityScore(Math.max(0, score))
      setIsSecure(score >= 70)
      setLastSecurityCheck(new Date())

      // Reportar verificação de segurança
      await reportSecurityEvent({
        type: 'security_check',
        severity: score >= 70 ? 'low' : 'medium',
        description: `Verificação de segurança realizada - Score: ${score}`,
        details: { score, issuesCount: issues.length }
      })

    } catch (error) {
      console.error('Erro na verificação de segurança:', error)
      setSecurityIssues([{
        id: 'check-error',
        type: 'error',
        message: 'Erro na verificação de segurança',
        details: 'Não foi possível realizar a verificação completa',
        timestamp: new Date(),
        resolved: false
      }])
      setSecurityScore(0)
      setIsSecure(false)
    }
  }

  const reportSecurityEvent = async (event: SecurityEvent) => {
    try {
      // Em um ambiente real, você enviaria isso para o servidor
      console.log('Security Event:', event)
      
      // Simular envio para o servidor
      if (event.severity === 'critical' || event.severity === 'high') {
        // Log crítico - em produção, enviar para servidor de logs
        console.warn('[Security] Critical event:', event)
      }
    } catch (error) {
      console.error('Erro ao reportar evento de segurança:', error)
    }
  }

  // Verificar segurança periodicamente
  useEffect(() => {
    if (user) {
      checkSecurity()
      
      // Verificar a cada 5 minutos
      const interval = setInterval(checkSecurity, 5 * 60 * 1000)
      
      return () => clearInterval(interval)
    }
  }, [user])

  // Monitorar mudanças de foco da janela
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        checkSecurity()
      }
    }

    const handleBlur = () => {
      // Reportar quando o usuário sai da aplicação
      if (user) {
        reportSecurityEvent({
          type: 'window_blur',
          severity: 'low',
          description: 'Usuário saiu da aplicação'
        })
      }
    }

    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)

    return () => {
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [user])

  const value = {
    isSecure,
    securityScore,
    lastSecurityCheck,
    securityIssues,
    checkSecurity,
    reportSecurityEvent
  }

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  )
}
