import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Send, Loader2, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WEBHOOKS } from "@/config/webhooks";

interface Lead {
  id: string;
  lead_name: string;
  lead_email: string | null;
  lead_number: string | null;
  cig_appalto: string | null;
  descrizione_appalto: string | null;
  project_id: string | null;
  value_eur: string | null;
  phase: string | null;
  cup: string | null;
  entity_role: string | null;
  lead_category: string | null;
  quality_status: string | null;
  full_name: string | null;
  role_title: string | null;
  website: string | null;
  street: string | null;
  cap: string | null;
  lead_city: string | null;
  lead_province: string | null;
  lead_region: string | null;
  country: string | null;
}

interface Upload {
  id: string;
  filename: string;
  uploaded_at: string;
  status: string;
  leads: Lead[];
}

export default function ProcessedTenders() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingToCRM, setSendingToCRM] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, Set<string>>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchUploads();
  }, []);

  const fetchUploads = async () => {
    setIsLoading(true);
    try {
      const { data: uploadsData, error: uploadsError } = await supabase
        .from('uploads')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (uploadsError) throw uploadsError;

      // Fetch leads for each upload
      const uploadsWithLeads = await Promise.all(
        (uploadsData || []).map(async (upload) => {
          const { data: leadsData } = await supabase
            .from('leads')
            .select('*')
            .eq('upload_id', upload.id);

          return {
            ...upload,
            leads: leadsData || []
          };
        })
      );

      setUploads(uploadsWithLeads);
    } catch (error) {
      console.error('Errore caricamento appalti:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare gli appalti elaborati",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (uploadId: string) => {
    setExpandedUploadId(expandedUploadId === uploadId ? null : uploadId);
  };

  const toggleLeadSelection = (uploadId: string, leadId: string) => {
    setSelectedLeads(prev => {
      const uploadSelections = new Set(prev[uploadId] || []);
      if (uploadSelections.has(leadId)) {
        uploadSelections.delete(leadId);
      } else {
        uploadSelections.add(leadId);
      }
      return { ...prev, [uploadId]: uploadSelections };
    });
  };

  const toggleSelectAll = (uploadId: string, leads: Lead[]) => {
    setSelectedLeads(prev => {
      const uploadSelections = prev[uploadId] || new Set();
      if (uploadSelections.size === leads.length) {
        return { ...prev, [uploadId]: new Set() };
      } else {
        return { ...prev, [uploadId]: new Set(leads.map(l => l.id)) };
      }
    });
  };

  const deleteUpload = async (uploadId: string) => {
    try {
      // First delete all associated leads
      const { error: leadsError } = await supabase
        .from('leads')
        .delete()
        .eq('upload_id', uploadId);

      if (leadsError) throw leadsError;

      // Then delete the upload
      const { error: uploadError } = await supabase
        .from('uploads')
        .delete()
        .eq('id', uploadId);

      if (uploadError) throw uploadError;

      toast({
        title: "Caricamento eliminato",
        description: "Il caricamento e tutti i lead associati sono stati eliminati",
      });

      // Refresh the list
      fetchUploads();
    } catch (error) {
      console.error('Errore eliminazione:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il caricamento",
        variant: "destructive",
      });
    }
  };

  const getSelectedLeadsForUpload = (uploadId: string, allLeads: Lead[]) => {
    const selectedIds = selectedLeads[uploadId] || new Set();
    return allLeads.filter(lead => selectedIds.has(lead.id));
  };

  const sendToCRM = async (upload: Upload) => {
    const leadsToSend = getSelectedLeadsForUpload(upload.id, upload.leads);
    
    if (leadsToSend.length === 0) {
      toast({
        title: "Nessun lead selezionato",
        description: "Seleziona almeno un lead da inviare al CRM",
        variant: "destructive",
      });
      return;
    }

    setSendingToCRM(upload.id);
    try {
      const response = await fetch(WEBHOOKS.CONFERMA_INVIO_CRM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          upload_id: upload.id,
          leads: leadsToSend 
        }),
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'invio al CRM');
      }

      toast({
        title: "Lead inviati al CRM",
        description: `${leadsToSend.length} lead sono stati inviati con successo`,
      });
      
      // Clear selection after successful send
      setSelectedLeads(prev => ({ ...prev, [upload.id]: new Set() }));
    } catch (error) {
      console.error('Errore invio CRM:', error);
      toast({
        title: "Errore",
        description: "Impossibile inviare i lead al CRM",
        variant: "destructive",
      });
    } finally {
      setSendingToCRM(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="flex justify-center items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Appalti elaborati</h1>
          
          {uploads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nessun appalto elaborato ancora</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => (
                <Card key={upload.id}>
                  <CardHeader 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1" onClick={() => toggleExpand(upload.id)}>
                        <CardTitle className="text-xl mb-2">{upload.filename}</CardTitle>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Caricato:</strong> {new Date(upload.uploaded_at).toLocaleString('it-IT')}</p>
                          <p><strong>Lead trovati:</strong> {upload.leads.length}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteUpload(upload.id);
                          }}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div onClick={() => toggleExpand(upload.id)}>
                          {expandedUploadId === upload.id ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  {expandedUploadId === upload.id && (
                    <CardContent>
                      {upload.leads.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">Nessun lead trovato</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto mb-6">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                   <TableHead className="w-12">
                                     <input
                                       type="checkbox"
                                       checked={(selectedLeads[upload.id]?.size || 0) === upload.leads.length && upload.leads.length > 0}
                                       onChange={() => toggleSelectAll(upload.id, upload.leads)}
                                       className="cursor-pointer"
                                     />
                                   </TableHead>
                                   <TableHead>CIG</TableHead>
                                   <TableHead>Descrizione</TableHead>
                                   <TableHead>Azienda/Nome</TableHead>
                                   <TableHead>Email</TableHead>
                                   <TableHead>Telefono</TableHead>
                                   <TableHead>Categoria</TableHead>
                                   <TableHead>Ruolo</TableHead>
                                   <TableHead>Valore €</TableHead>
                                   <TableHead>Fase</TableHead>
                                   <TableHead>Città</TableHead>
                                   <TableHead>Regione</TableHead>
                                   <TableHead>Website</TableHead>
                                   <TableHead>Qualità</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {upload.leads.map((lead) => (
                                  <TableRow key={lead.id}>
                                     <TableCell>
                                       <input
                                         type="checkbox"
                                         checked={selectedLeads[upload.id]?.has(lead.id) || false}
                                         onChange={() => toggleLeadSelection(upload.id, lead.id)}
                                         className="cursor-pointer"
                                       />
                                     </TableCell>
                                     <TableCell className="font-medium">{lead.cig_appalto || '-'}</TableCell>
                                     <TableCell className="max-w-xs truncate">{lead.descrizione_appalto || '-'}</TableCell>
                                     <TableCell className="font-medium">{lead.lead_name}</TableCell>
                                     <TableCell>{lead.lead_email || '-'}</TableCell>
                                     <TableCell>{lead.lead_number || '-'}</TableCell>
                                     <TableCell>
                                       <span className="text-xs bg-secondary px-2 py-1 rounded">
                                         {lead.lead_category || '-'}
                                       </span>
                                     </TableCell>
                                     <TableCell className="text-xs">{lead.entity_role || '-'}</TableCell>
                                     <TableCell>{lead.value_eur ? `€${parseInt(lead.value_eur).toLocaleString()}` : '-'}</TableCell>
                                     <TableCell>{lead.phase || '-'}</TableCell>
                                     <TableCell>{lead.lead_city || '-'}</TableCell>
                                     <TableCell>{lead.lead_region || '-'}</TableCell>
                                     <TableCell>
                                       {lead.website ? (
                                         <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                           Link
                                         </a>
                                       ) : '-'}
                                     </TableCell>
                                     <TableCell>
                                       <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                         {lead.quality_status || '-'}
                                       </span>
                                     </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          
                          <div className="flex justify-center">
                            <Button
                              onClick={() => sendToCRM(upload)}
                              disabled={sendingToCRM === upload.id}
                              className="gap-2"
                              size="lg"
                            >
                              {sendingToCRM === upload.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Invio in corso...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Invia {selectedLeads[upload.id]?.size || 0} lead al CRM
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      )}
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
