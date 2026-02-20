import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../shared/cors.ts'
import { createAuthMiddleware, createRateLimitMiddleware } from '../auth-middleware/index.ts'

// Rate limiting: 100 requests per 15 minutes
const rateLimit = createRateLimitMiddleware(100, 15 * 60 * 1000)

// Auth middleware requiring authentication and specific permissions
const authMiddleware = createAuthMiddleware({
  requireAuth: true,
  requirePermission: ['pode_acessar_solicitacao']
})

serve(async (req) => {
  return rateLimit(req, async (req) => {
    return authMiddleware(req, async (req, user, supabase) => {
      try {
        const url = new URL(req.url)
        const path = url.pathname

        switch (path) {
          case '/api/pricing/suggestions':
            return handleSuggestions(req, user, supabase)

          case '/api/pricing/approve':
            return handleApprove(req, user, supabase)

          case '/api/pricing/history':
            return handleHistory(req, user, supabase)

          case '/api/pricing/cost':
            return handleCost(req, user, supabase)

          default:
            return new Response(
              JSON.stringify({ error: 'Endpoint não encontrado' }),
              {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404
              }
            )
        }
      } catch (error) {
        console.error('Pricing API error:', error)
        return new Response(
          JSON.stringify({ error: 'Erro interno do servidor' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          }
        )
      }
    })
  })
})

async function handleSuggestions(req: Request, user: any, supabase: any) {
  if (req.method === 'GET') {
    // Get user's suggestions
    const { data, error } = await supabase
      .from('price_suggestions')
      .select(`
        *,
        clients(name),
        stations(name),
        payment_methods(descricao)
      `)
      .eq('usuario_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar sugestões' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        suggestions: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  }

  if (req.method === 'POST') {
    // Create new suggestion
    const body = await req.json()

    // Validate required fields
    const requiredFields = ['station_id', 'client_id', 'product', 'payment_method_id', 'cost_price']
    for (const field of requiredFields) {
      if (!body[field]) {
        return new Response(
          JSON.stringify({ error: `Campo obrigatório: ${field}` }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400
          }
        )
      }
    }

    // Validate price
    if (body.cost_price <= 0) {
      return new Response(
        JSON.stringify({ error: 'Preço de custo deve ser maior que zero' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        }
      )
    }

    const { data, error } = await supabase
      .from('price_suggestions')
      .insert({
        usuario_id: user.id,
        posto_id: body.station_id,
        cliente_id: body.client_id,
        produto: body.product,
        tipo_pagamento_id: body.payment_method_id,
        preco_custo: body.cost_price,
        preco_custo_com_taxa: body.cost_price_with_tax,
        margem: body.margin,
        observacao: body.observation,
        imagem_url: body.image_url,
        tipo_referencia: body.reference_type || 'sem_referencia',
        status: 'em_analise'
      })
      .select()
      .single()

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao criar sugestão' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        }
      )
    }

    // Log security event
    await supabase
      .from('security_audit_log')
      .insert({
        user_id: user.id,
        action: 'create_suggestion',
        resource: 'price_suggestions',
        details: { suggestion_id: data.id }
      })

    return new Response(
      JSON.stringify({
        success: true,
        suggestion: data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      }
    )
  }

  return new Response(
    JSON.stringify({ error: 'Método não permitido' }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405
    }
  )
}

async function handleApprove(req: Request, user: any, supabase: any) {
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
  }

  // Check if user has approval permission
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('pode_acessar_aprovacao, pode_aprovar_direto')
    .eq('user_id', user.id)
    .single()

  if (!profile?.pode_acessar_aprovacao) {
    return new Response(
      JSON.stringify({ error: 'Sem permissão para aprovar' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403
      }
    )
  }

  const body = await req.json()
  const { suggestion_id, decision, observation } = body

  if (!suggestion_id || !decision) {
    return new Response(
      JSON.stringify({ error: 'ID da sugestão e decisão são obrigatórios' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }

  if (!['aprovado', 'negado'].includes(decision)) {
    return new Response(
      JSON.stringify({ error: 'Decisão deve ser "aprovado" ou "negado"' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }

  // Update suggestion status
  const { data, error } = await supabase
    .from('price_suggestions')
    .update({
      status: decision,
      updated_at: new Date().toISOString()
    })
    .eq('id', suggestion_id)
    .select()
    .single()

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao atualizar sugestão' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }

  // Create approval record
  await supabase
    .from('price_approvals')
    .insert({
      sugestao_id: suggestion_id,
      usuario_id: user.id,
      nivel_aprovacao: 1,
      decisao: decision,
      observacao: observation,
      data_decisao: new Date().toISOString()
    })

  // Log security event
  await supabase
    .from('security_audit_log')
    .insert({
      user_id: user.id,
      action: 'approve_suggestion',
      resource: 'price_suggestions',
      details: { suggestion_id, decision }
    })

  return new Response(
    JSON.stringify({
      success: true,
      suggestion: data
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

async function handleHistory(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
  }

  const url = new URL(req.url)
  const stationId = url.searchParams.get('station_id')
  const product = url.searchParams.get('product')
  const limit = parseInt(url.searchParams.get('limit') || '50')

  let query = supabase
    .from('price_history')
    .select(`
      *,
      stations(name),
      clients(name)
    `)
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 100))

  if (stationId) {
    query = query.eq('station_id', stationId)
  }

  if (product) {
    query = query.eq('product', product)
  }

  const { data, error } = await query

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar histórico' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      history: data
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}

async function handleCost(req: Request, user: any, supabase: any) {
  if (req.method !== 'GET') {
    return new Response(
      JSON.stringify({ error: 'Método não permitido' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405
      }
    )
  }

  const url = new URL(req.url)
  const stationId = url.searchParams.get('station_id')
  const product = url.searchParams.get('product')
  const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0]

  if (!stationId || !product) {
    return new Response(
      JSON.stringify({ error: 'station_id e product são obrigatórios' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }

  // Use RPC function to get cost data
  const { data, error } = await supabase
    .rpc('get_lowest_cost_freight', {
      p_posto_id: stationId,
      p_produto: product,
      p_date: date
    })

  if (error) {
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar custo' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }

  return new Response(
    JSON.stringify({
      success: true,
      cost_data: data
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    }
  )
}
