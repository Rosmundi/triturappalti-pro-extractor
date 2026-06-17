import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log('Receiving results from n8n callback...');
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('Received callback body keys:', Object.keys(body));

    // Extract upload_id and leads from the callback
    const uploadId = body.upload_id ?? body?.[0]?.upload_id;
    const filename = body.filename ?? body?.[0]?.filename;
    
    if (!uploadId) {
      throw new Error('upload_id mancante nel callback');
    }

    // Normalize the leads array from various possible n8n payload formats:
    //   { upload_id, data: [ {lead}, ... ] }
    //   { upload_id, leads: [ {lead}, ... ] }
    //   [ {lead}, ... ]
    //   [ { data: [ {lead}, ... ] } ]   <-- wrapped format
    //   { data: [ [ {lead}, ... ] ] }   <-- nested arrays
    let leadsArray: any[] = [];
    const candidates: any[] = [];
    if (Array.isArray(body)) candidates.push(body);
    if (Array.isArray(body?.data)) candidates.push(body.data);
    if (Array.isArray(body?.leads)) candidates.push(body.leads);
    if (Array.isArray(body?.[0]?.data)) candidates.push(body[0].data);
    if (Array.isArray(body?.[0]?.leads)) candidates.push(body[0].leads);

    const flatten = (arr: any[]): any[] =>
      arr.flatMap((item) => (Array.isArray(item) ? flatten(item) : [item]));

    const isLead = (x: any) =>
      x && typeof x === 'object' && !Array.isArray(x) &&
      (x.lead_company || x.lead_surname || x.lead_email || x.project_id || x.nome_appalto);

    for (const c of candidates) {
      const flat = flatten(c).filter(isLead);
      if (flat.length > 0) { leadsArray = flat; break; }
    }

    console.log(`Processing callback for upload ${uploadId} with ${leadsArray.length} leads`);

    if (leadsArray.length === 0) {
      // Update upload status to error if no leads
      await supabase
        .from('uploads')
        .update({ status: 'error' })
        .eq('id', uploadId);
      
      throw new Error('Nessun lead trovato nei risultati di n8n');
    }

    // Get tender info from first lead
    const firstLead = leadsArray[0];

    // Update the upload record with tender info and completed status
    const { error: uploadError } = await supabase
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

    if (uploadError) {
      console.error('Error updating upload record:', uploadError);
      throw new Error('Impossibile aggiornare il record di upload');
    }

    console.log(`Updated upload record ${uploadId} to completed`);

    // Insert all leads linked to this upload
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
      nome_appalto: lead.nome_appalto || null,
      categoria_progetto: lead.categoria_progetto || null,
      tipo_intervento: lead.tipo_intervento || null,
      committente_tipo: lead.committente_tipo || null,
      categorie_og: lead.categorie_og || null,
      procedura_gara: lead.procedura_gara || null,
      finanziamento: lead.finanziamento || null,
      data_appalto: lead.data_appalto || null,
      data_fine_lavori: lead.data_fine_lavori || null,
      termine_offerta: lead.termine_offerta || null,
    }));

    const { error: leadsError } = await supabase.from('leads').insert(leadsToInsert);

    if (leadsError) {
      console.error('Error inserting leads:', leadsError);
      // Revert upload status
      await supabase
        .from('uploads')
        .update({ status: 'error' })
        .eq('id', uploadId);
      throw new Error('Impossibile salvare i lead nel database');
    }

    console.log(`Successfully saved ${leadsArray.length} leads for upload ${uploadId}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: `Callback elaborato: ${leadsArray.length} lead salvati`,
      uploadId: uploadId,
      leadsCount: leadsArray.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing n8n callback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
