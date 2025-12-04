import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the form data from the request
    const formData = await req.formData();
    const filename = formData.get('filename') as string || 'unknown.pdf';
    
    console.log(`Processing file: ${filename}`);
    console.log('Forwarding to n8n webhook...');

    // Forward to n8n webhook
    const n8nResponse = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      body: formData,
    });

    console.log(`n8n response status: ${n8nResponse.status}`);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('n8n error response:', errorText);
      
      // Provide user-friendly error messages based on status
      if (n8nResponse.status === 524) {
        throw new Error('Timeout di Cloudflare: il file PDF è troppo grande. Prova con file più piccoli (elaborazione < 2 minuti).');
      } else if (n8nResponse.status >= 500) {
        throw new Error(`Errore del server n8n (${n8nResponse.status}). Riprova più tardi.`);
      } else {
        throw new Error(`Errore n8n: ${n8nResponse.status}`);
      }
    }

    const responseText = await n8nResponse.text();
    console.log('n8n response length:', responseText.length);

    if (!responseText || responseText.trim().length === 0) {
      throw new Error('Risposta vuota da n8n');
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('Parsed n8n response successfully');
    } catch (parseError) {
      console.error('Failed to parse n8n response as JSON:', parseError);
      throw new Error('Risposta n8n non valida (non è JSON)');
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

    console.log(`Extracted ${leadsArray.length} leads from n8n response`);

    if (leadsArray.length === 0) {
      throw new Error('Nessun lead trovato nella risposta di n8n');
    }

    // Create upload record with tender info from first lead
    const firstLead = leadsArray[0];
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        filename,
        status: 'completed',
        cig_appalto: firstLead?.cig_appalto || null,
        descrizione_appalto: firstLead?.descrizione_appalto || null,
        value_eur: firstLead?.value_eur || null,
        phase: firstLead?.phase || null,
        cup: firstLead?.cup || null,
        appalto_location: firstLead?.appalto_location || null,
      })
      .select()
      .single();

    if (uploadError) {
      console.error('Error creating upload record:', uploadError);
      throw new Error('Impossibile salvare il record di upload');
    }

    console.log(`Created upload record with ID: ${uploadData.id}`);

    // Insert all leads linked to this upload
    const leadsToInsert = leadsArray.map(lead => ({
      upload_id: uploadData.id,
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
      console.error('Error inserting leads:', leadsError);
      // Delete the upload record if leads insertion fails
      await supabase.from('uploads').delete().eq('id', uploadData.id);
      throw new Error('Impossibile salvare i lead nel database');
    }

    console.log(`Successfully saved ${leadsArray.length} leads`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Elaborazione completata: ${leadsArray.length} lead estratti`,
      uploadId: uploadData.id,
      leadsCount: leadsArray.length
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
