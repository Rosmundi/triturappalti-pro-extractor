import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const N8N_WEBHOOK_URL = "https://mrosmundi.app.n8n.cloud/webhook-test/8b10b1ca-c0d3-4906-9606-7824781c7af0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Receiving PDF for processing...');
    
    // Get the form data from the request
    const formData = await req.formData();
    
    // Forward the form data to n8n webhook
    console.log('Forwarding to n8n webhook...');
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    console.log('n8n response status:', n8nResponse.status);
    console.log('n8n response headers:', Object.fromEntries(n8nResponse.headers.entries()));

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n webhook error response:', errorText);
      throw new Error(`n8n webhook error: ${n8nResponse.status} - ${errorText}`);
    }

    // Get response as text first to check if it's valid
    const responseText = await n8nResponse.text();
    console.log('n8n response text:', responseText.substring(0, 500));

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(responseText);
      console.log('n8n response parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse n8n response as JSON:', parseError);
      throw new Error(`Invalid JSON response from n8n: ${responseText.substring(0, 200)}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing PDF:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
