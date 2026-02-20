import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'

interface AuthMiddlewareOptions {
  requireAuth?: boolean;
  requireRole?: string[];
  requirePermission?: string[];
}

export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  return async (req: Request, handler: (req: Request, user: any, supabase: any) => Promise<Response>) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders })
    }

    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )

      // Extract token from Authorization header
      const authHeader = req.headers.get('Authorization')
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (options.requireAuth) {
          return new Response(
            JSON.stringify({ error: 'Token de autorização necessário' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 401
            }
          )
        }
        return handler(req, null, supabaseClient)
      }

      const token = authHeader.substring(7) // Remove 'Bearer ' prefix

      // Verify token and get user
      const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)

      if (authError || !user) {
        if (options.requireAuth) {
          return new Response(
            JSON.stringify({ error: 'Token inválido ou expirado' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 401
            }
          )
        }
        return handler(req, null, supabaseClient)
      }

      // Get user profile with permissions
      const { data: profile, error: profileError } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (profileError || !profile) {
        if (options.requireAuth) {
          return new Response(
            JSON.stringify({ error: 'Perfil de usuário não encontrado' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403
            }
          )
        }
        return handler(req, user, supabaseClient)
      }

      // Check role requirements
      if (options.requireRole && !options.requireRole.includes(profile.role)) {
        return new Response(
          JSON.stringify({ error: 'Permissão insuficiente - papel requerido' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403
          }
        )
      }

      // Check permission requirements
      if (options.requirePermission) {
        const hasPermission = options.requirePermission.every(permission =>
          profile[permission] === true
        )

        if (!hasPermission) {
          return new Response(
            JSON.stringify({ error: 'Permissão insuficiente - permissão específica requerida' }),
            {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 403
            }
          )
        }
      }

      // Log security event
      await supabaseClient
        .from('security_audit_log')
        .insert({
          user_id: user.id,
          action: 'api_access',
          resource: req.url,
          method: req.method,
          ip_address: req.headers.get('x-forwarded-for') || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown'
        })

      return handler(req, { ...user, profile }, supabaseClient)

    } catch (error) {
      console.error('Auth middleware error:', error)
      return new Response(
        JSON.stringify({ error: 'Erro interno do servidor' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }
  }
}

// Rate limiting middleware
export function createRateLimitMiddleware(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
  const requests = new Map<string, { count: number; resetTime: number }>()

  return async (req: Request, handler: (req: Request) => Promise<Response>) => {
    const clientId = req.headers.get('x-forwarded-for') || 'unknown'
    const now = Date.now()

    const clientData = requests.get(clientId)

    if (!clientData || now > clientData.resetTime) {
      requests.set(clientId, { count: 1, resetTime: now + windowMs })
    } else {
      clientData.count++

      if (clientData.count > maxRequests) {
        return new Response(
          JSON.stringify({ error: 'Muitas requisições. Tente novamente mais tarde.' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 429
          }
        )
      }
    }

    return handler(req)
  }
}

// Input validation middleware
export function createValidationMiddleware(schema: any) {
  return async (req: Request, handler: (req: Request, validatedData: any) => Promise<Response>) => {
    try {
      const body = await req.json()
      const validatedData = schema.parse(body)
      return handler(req, validatedData)
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: 'Dados de entrada inválidos',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }
  }
}
