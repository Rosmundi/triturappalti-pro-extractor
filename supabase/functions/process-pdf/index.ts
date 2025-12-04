import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const N8N_WEBHOOK_URL = "https://mrosmundi.app.n8n.cloud/webhook-test/8b10b1ca-c0d3-4906-9606-7824781c7af0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Background task to process PDF via n8n and save results
async function processInBackground(uploadId: string, formData: FormData, filename: string) {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log(`[Background] Starting n8n processing for upload ${uploadId}...`);
    
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    console.log(`[Background] n8n response status: ${n8nResponse.status}`);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error(`[Background] n8n error: ${errorText}`);
      
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
      return;
    }

    const responseText = await n8nResponse.text();
    console.log(`[Background] n8n response length: ${responseText.length}`);

    if (!responseText || responseText.trim().length === 0) {
      console.error('[Background] Empty response from n8n');
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
      return;
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('[Background] Failed to parse JSON:', parseError);
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
      return;
    }

    // Normalize the response to get leads array
    let leadsArray: any[] = [];
    if (Array.isArray(result)) {
      if (result.length > 0 && result[0].data && Array.isArray(result[0].data)) {
        leadsArray = result[0].data;
      } else {
        leadsArray = result;
      }
    } else if (Array.isArray(result?.leads)) {
      leadsArray = result.leads;
    } else if (Array.isArray(result?.data)) {
      leadsArray = result.data;
    } else if (result) {
      leadsArray = [result];
    }

    console.log(`[Background] Extracted ${leadsArray.length} leads`);

    if (leadsArray.length === 0) {
      console.error('[Background] No leads found');
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
      return;
    }

    // Update upload with tender info from first lead
    const firstLead = leadsArray[0];
    const { error: updateError } = await supabase
      .from('uploads')
      .update({
        status: 'completed',
        cig_appalto: firstLead?.cig_appalto || null,
        descrizione_appalto: firstLead?.descrizione_appalto || null,
        value_eur: firstLead?.value_eur || null,
        phase: firstLead?.phase || null,
        cup: firstLead?.cup || null,
        appalto_location: firstLead?.appalto_location || null,
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('[Background] Error updating upload:', updateError);
      return;
    }

    // Insert all leads
    const leadsToInsert = leadsArray.map(lead => ({
      upload_id: uploadId,
      lead_company: lead.lead_company || 'N/A',
      lead_surname: lead.lead_surname || null,
      lead_email: lead.lead_email || null,
      lead_number: lead.lead_number || null,
      project_id: lead.project_id || null,
      entity_role: lead.entity_role || null,
      lead_category: lead.lead_category || null,
      quality_status: lead.quality_status || null,
      website: lead.website || null,
      street: lead.street || null,
      cap: lead.cap || null,
      lead_city: lead.lead_city || null,
      lead_province: lead.lead_province || null,
      country: lead.country || null,
      appalto_location: lead.appalto_location || null,
      cig_appalto: lead.cig_appalto || null,
      descrizione_appalto: lead.descrizione_appalto || null,
      value_eur: lead.value_eur || null,
      phase: lead.phase || null,
      cup: lead.cup || null,
    }));

    const { error: leadsError } = await supabase.from('leads').insert(leadsToInsert);

    if (leadsError) {
      console.error('[Background] Error inserting leads:', leadsError);
      await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
      return;
    }

    console.log(`[Background] Successfully saved ${leadsArray.length} leads for upload ${uploadId}`);

  } catch (error) {
    console.error('[Background] Error:', error);
    await supabase.from('uploads').update({ status: 'error' }).eq('id', uploadId);
  }
}

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
    
    // Create upload record immediately with 'processing' status
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

    console.log(`Created upload record ${uploadData.id}, starting background processing...`);

    // Start background processing (don't await)
    EdgeRuntime.waitUntil(processInBackground(uploadData.id, formData, filename));

    // Return immediately with upload ID
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Elaborazione avviata in background',
      uploadId: uploadData.id,
      status: 'processing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
