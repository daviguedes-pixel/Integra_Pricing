import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { corsHeaders } from "../shared/cors.ts"

const WEBHOOK_URL = "https://brapoio-n8n.fly.dev/webhook/b372035b-bcc3-4e85-8d2e-350aed49c105"

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
        console.log("n8n response body prefix:", responseText.substring(0, 100))

        // Try to parse as JSON to ensure we return valid JSON
        let responseJson;
        try {
            responseJson = JSON.parse(responseText);
        } catch (e) {
            console.error("n8n returned non-JSON:", responseText);
            // If it's HTML/XML or text, wrap it in a JSON object so the client doesn't crash
            return new Response(JSON.stringify({
                error: "Invalid response from n8n webhook",
                details: responseText.substring(0, 500), // Limit length
                statusCode: response.status
            }), {
                status: response.status >= 200 && response.status < 300 ? 200 : response.status, // Force 200 if upstream logic is weird, or keep status
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        return new Response(JSON.stringify(responseJson), {
            status: response.status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
        })
    } catch (err: any) {
        const error = err as Error;
        console.error("Error in sync-n8n function:", error)

        // Return structured error
        return new Response(JSON.stringify({
            error: "Failed to connect to n8n",
            message: error.message,
            stack: error.stack,
            webhook_url: WEBHOOK_URL
        }), {
            status: 502, // Bad Gateway
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
        })
    }
})
