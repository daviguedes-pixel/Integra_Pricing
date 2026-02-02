import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../shared/cors.ts"

const WEBHOOK_URL = "https://n8n.hetz.com/webhook/c3c95968-cf5e-4b85-8a89-9a9fd5112eb6"

serve(async (req: Request) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()

        console.log("Forwarding request to n8n:", body)

        // Standard fetch using HTTPS. 
        // Supabase Edge Functions call this from the server, avoiding Mixed Content browser errors.
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })

        const responseText = await response.text()
        console.log("n8n response status:", response.status)

        return new Response(responseText, {
            status: response.status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
        })
    } catch (err: any) {
        const error = err as Error;
        console.error("Error in sync-n8n function:", error)
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
        })
    }
})
