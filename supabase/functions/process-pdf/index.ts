import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const N8N_WEBHOOK_URL = "https://mrosmundi.app.n8n.cloud/webhook/8b10b1ca-c0d3-4906-9606-7824781c7af0";

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
    console.log('Receiving PDF for async processing...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the form data from the request
    const formData = await req.formData();
    const filename = formData.get('filename') as string || 'unknown.pdf';
    
    console.log(`Processing file: ${filename}`);

    // Create upload record with 'processing' status FIRST
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        filename,
        status: 'processing',
      })
      .select()
      .single();

    if (uploadError) {
      console.error('Error creating upload record:', uploadError);
      throw new Error('Impossibile creare il record di upload');
    }

    const uploadId = uploadData.id;
    console.log(`Created upload record with ID: ${uploadId}`);

    // Get the callback URL for n8n to use
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const callbackUrl = `${supabaseUrl}/functions/v1/receive-n8n-results`;

    // Append upload_id and callback_url to formData for n8n
    formData.append('upload_id', uploadId);
    formData.append('callback_url', callbackUrl);

    console.log(`Forwarding to n8n with callback URL: ${callbackUrl}`);

    // Forward to n8n webhook - fire and forget style with short timeout
    // We don't wait for the full response, just confirm n8n received it
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout just to confirm receipt

    try {
      const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`n8n initial response status: ${n8nResponse.status}`);

      if (!n8nResponse.ok && n8nResponse.status !== 504 && n8nResponse.status !== 524) {
        // If n8n immediately rejects, mark as error
        const errorText = await n8nResponse.text();
        console.error('n8n error response:', errorText);
        
        await supabase
          .from('uploads')
          .update({ status: 'error' })
          .eq('id', uploadId);
        
        throw new Error(`Errore n8n: ${n8nResponse.status}`);
      }

      // For timeout responses (504, 524), that's expected - n8n is still processing
      if (n8nResponse.status === 504 || n8nResponse.status === 524) {
        console.log('n8n is processing in background (timeout response expected)');
      }

    } catch (fetchError) {
      // AbortError means timeout - that's OK, n8n is processing
      if (fetchError.name === 'AbortError') {
        console.log('Request to n8n timed out - n8n is processing in background');
      } else {
        console.error('Error sending to n8n:', fetchError);
        await supabase
          .from('uploads')
          .update({ status: 'error' })
          .eq('id', uploadId);
        throw new Error('Impossibile inviare il file a n8n');
      }
    }

    // Return immediately with upload info
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Elaborazione avviata. I risultati appariranno nella pagina "Appalti elaborati" quando n8n avrà completato.',
      uploadId: uploadId,
      status: 'processing'
    }), {
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
