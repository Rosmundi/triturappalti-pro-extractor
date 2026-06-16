import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Send, Loader2, Trash2, FileText, Briefcase, Users, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  lead_company: string;
  lead_surname: string | null;
  lead_email: string | null;
  lead_number: string | null;
  project_id: string | null;
  entity_role: string | null;
  lead_category: string | null;
  quality_status: string | null;
  website: string | null;
  street: string | null;
  cap: string | null;
  lead_city: string | null;
  lead_province: string | null;
  country: string | null;
  appalto_location: string | null;
  // Tender-specific fields
  cig_appalto: string | null;
  descrizione_appalto: string | null;
  value_eur: string | null;
  phase: string | null;
  cup: string | null;
  notes: string | null;
}

interface Tender {
  project_id: string;
  cig_appalto: string | null;
  descrizione_appalto: string | null;
  value_eur: string | null;
  phase: string | null;
  cup: string | null;
  appalto_location: string | null;
  leads: Lead[];
}

interface Upload {
  id: string;
  filename: string;
  uploaded_at: string;
  status: string;
  leads: Lead[];
  tenders: Tender[];
}

export default function ProcessedTenders() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(null);
  const [expandedTenders, setExpandedTenders] = useState<Record<string, Set<string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sendingToCRM, setSendingToCRM] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, Set<string>>>({});
  const [selectAllPdf, setSelectAllPdf] = useState<Record<string, boolean>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
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

      // Fetch leads for each upload and group by tender
      const uploadsWithTenders = await Promise.all(
        (uploadsData || []).map(async (upload) => {
          const { data: leadsData } = await supabase
            .from('leads')
            .select('*')
            .eq('upload_id', upload.id);

          // Group leads by project_id (tender)
          const tenderMap = new Map<string, Tender>();
          
          (leadsData || []).forEach((lead) => {
            const projectId = lead.project_id || 'unknown';
            
            if (!tenderMap.has(projectId)) {
              tenderMap.set(projectId, {
                project_id: projectId,
                cig_appalto: lead.cig_appalto,
                descrizione_appalto: lead.descrizione_appalto,
                value_eur: lead.value_eur,
                phase: lead.phase,
                cup: lead.cup,
                appalto_location: lead.appalto_location,
                leads: []
              });
            }
            
            tenderMap.get(projectId)!.leads.push(lead);
          });

          return {
            ...upload,
            leads: leadsData || [],
            tenders: Array.from(tenderMap.values())
          };
        })
      );

      setUploads(uploadsWithTenders);
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

  const toggleTender = (uploadId: string, tenderId: string) => {
    setExpandedTenders(prev => {
      const uploadTenders = new Set(prev[uploadId] || []);
      if (uploadTenders.has(tenderId)) {
        uploadTenders.delete(tenderId);
      } else {
        uploadTenders.add(tenderId);
      }
      return { ...prev, [uploadId]: uploadTenders };
    });
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

  const updateLeadNotes = async (leadId: string, notes: string) => {
    setSavingNoteId(leadId);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ notes })
        .eq('id', leadId);
      if (error) throw error;
    } catch (error) {
      console.error('Errore salvataggio nota:', error);
      toast({
        title: "Errore",
        description: "Impossibile salvare la nota",
        variant: "destructive",
      });
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleNoteChange = (uploadId: string, leadId: string, value: string) => {
    setUploads(prev => prev.map(u => {
      if (u.id !== uploadId) return u;
      return {
        ...u,
        leads: u.leads.map(l => l.id === leadId ? { ...l, notes: value } : l),
        tenders: u.tenders.map(t => ({
          ...t,
          leads: t.leads.map(l => l.id === leadId ? { ...l, notes: value } : l),
        })),
      };
    }));
  };

  const toggleSelectAllTender = (uploadId: string, tender: Tender) => {
    setSelectedLeads(prev => {
      const uploadSelections = new Set(prev[uploadId] || []);
      const tenderLeadIds = tender.leads.map(l => l.id);
      const allSelected = tenderLeadIds.every(id => uploadSelections.has(id));
      
      tenderLeadIds.forEach(id => {
        if (allSelected) {
          uploadSelections.delete(id);
        } else {
          uploadSelections.add(id);
        }
      });
      
      return { ...prev, [uploadId]: uploadSelections };
    });
  };

  const toggleSelectAllPdf = (uploadId: string, allLeads: Lead[]) => {
    const allLeadIds = allLeads.map(l => l.id);
    const allSelected = allLeadIds.every(id => selectedLeads[uploadId]?.has(id));
    
    setSelectedLeads(prev => {
      const uploadSelections = new Set(prev[uploadId] || []);
      
      allLeadIds.forEach(id => {
        if (allSelected) {
          uploadSelections.delete(id);
        } else {
          uploadSelections.add(id);
        }
      });
      
      return { ...prev, [uploadId]: uploadSelections };
    });
    
    setSelectAllPdf(prev => ({ ...prev, [uploadId]: !allSelected }));
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
      // Send leads with complete hierarchy: upload info + tender info + lead info
      const leadsWithCompleteInfo = leadsToSend.map(lead => {
        // Find the tender this lead belongs to
        const tender = upload.tenders.find(t => 
          t.leads.some(l => l.id === lead.id)
        );

        return {
          // Upload info (Level 1)
          upload_id: upload.id,
          filename: upload.filename,
          uploaded_at: upload.uploaded_at,
          
          // Tender info (Level 2)
          project_id: lead.project_id,
          cig_appalto: tender?.cig_appalto,
          descrizione_appalto: tender?.descrizione_appalto,
          value_eur: tender?.value_eur,
          phase: tender?.phase,
          cup: tender?.cup,
          appalto_location: lead.appalto_location,
          
          // Lead info (Level 3)
          ...lead
        };
      });

      const response = await fetch(WEBHOOKS.CONFERMA_INVIO_CRM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          leads: leadsWithCompleteInfo 
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
      <main className="w-full px-6 py-10 print:px-2 print:py-2">
        <div className="w-full max-w-none mx-auto print:max-w-none">
          <div className="flex items-center justify-between mb-8 print:mb-4">
            <h1 className="text-4xl font-bold print:text-2xl">Appalti elaborati</h1>
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="print:hidden"
            >
              Stampa
            </Button>
          </div>
          
          {uploads.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Nessun appalto elaborato ancora</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {uploads.map((upload) => {
                const totalTenders = upload.tenders.length;
                const totalLeads = upload.leads.length;
                
                return (
                  <Card key={upload.id}>
                    {/* Level 1: Upload */}
                    <CardHeader 
                      className="cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => toggleExpand(upload.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3 flex-1">
                          <FileText className="h-5 w-5 text-primary" />
                          <div>
                            <CardTitle className="text-xl mb-2">{upload.filename}</CardTitle>
                            <div className="text-sm text-muted-foreground space-x-4">
                              <span><strong>Data:</strong> {new Date(upload.uploaded_at).toLocaleDateString('it-IT')}</span>
                              <span><strong>Appalti:</strong> {totalTenders}</span>
                              <span><strong>Lead:</strong> {totalLeads}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={upload.leads.every(l => selectedLeads[upload.id]?.has(l.id))}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectAllPdf(upload.id, upload.leads);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                            title="Seleziona tutti i lead di questo PDF"
                          />
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => e.stopPropagation()}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-destructive" />
                                  Conferma eliminazione
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sei sicuro di voler eliminare "{upload.filename}" e tutti i {totalLeads} lead associati? 
                                  Questa azione non può essere annullata.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteUpload(upload.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {expandedUploadId === upload.id ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    
                    {/* Level 2: Tenders */}
                    {expandedUploadId === upload.id && (
                      <CardContent className="space-y-3">
                        {upload.tenders.length === 0 ? (
                          <p className="text-muted-foreground text-center py-4">Nessun appalto trovato</p>
                        ) : (
                          <>
                            {upload.tenders.map((tender) => {
                              const isTenderExpanded = expandedTenders[upload.id]?.has(tender.project_id);
                              const tenderLeadIds = tender.leads.map(l => l.id);
                              const selectedCount = tenderLeadIds.filter(id => 
                                selectedLeads[upload.id]?.has(id)
                              ).length;
                              const allTenderSelected = selectedCount === tender.leads.length && tender.leads.length > 0;
                              
                              return (
                                <Card key={tender.project_id} className="bg-muted/30">
                                  <CardHeader 
                                    className="cursor-pointer hover:bg-accent/30 transition-colors py-3"
                                    onClick={() => toggleTender(upload.id, tender.project_id)}
                                  >
                                    <div className="flex justify-between items-start">
                                      <div className="flex items-center gap-3 flex-1">
                                        <Briefcase className="h-4 w-4 text-primary" />
                                        <div className="space-y-1">
                                          <div className="font-semibold">{tender.descrizione_appalto || 'Appalto senza descrizione'}</div>
                                          <div className="text-xs text-muted-foreground space-x-3">
                                            {tender.cig_appalto && <span><strong>CIG:</strong> {tender.cig_appalto}</span>}
                                            {tender.value_eur && <span><strong>Valore:</strong> €{parseInt(tender.value_eur).toLocaleString()}</span>}
                                            {tender.phase && <span><strong>Fase:</strong> {tender.phase}</span>}
                                            {tender.appalto_location && <span><strong>Località:</strong> {tender.appalto_location}</span>}
                                            <span><strong>Lead:</strong> {tender.leads.length}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={allTenderSelected}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelectAllTender(upload.id, tender);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="cursor-pointer"
                                          title="Seleziona tutti i lead di questo appalto"
                                        />
                                        {isTenderExpanded ? (
                                          <ChevronDown className="h-4 w-4" />
                                        ) : (
                                          <ChevronRight className="h-4 w-4" />
                                        )}
                                      </div>
                                    </div>
                                  </CardHeader>

                                  {/* Level 3: Leads */}
                                  {isTenderExpanded && (
                                    <CardContent className="pt-4">
                                      <div className="overflow-x-auto">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead className="w-12">
                                                <Users className="h-4 w-4" />
                                              </TableHead>
                                              <TableHead>Azienda</TableHead>
                                              <TableHead>Referente</TableHead>
                                              <TableHead>Email</TableHead>
                                              <TableHead>Telefono</TableHead>
                                              <TableHead>Categoria</TableHead>
                                              <TableHead>Ruolo</TableHead>
                                              <TableHead>Città</TableHead>
                                              <TableHead>Provincia</TableHead>
                                              <TableHead>Website</TableHead>
                                              <TableHead>Qualità</TableHead>
                                              <TableHead className="min-w-[220px] print:min-w-0">Note</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {tender.leads.map((lead) => (
                                              <TableRow key={lead.id}>
                                                <TableCell>
                                                  <input
                                                    type="checkbox"
                                                    checked={selectedLeads[upload.id]?.has(lead.id) || false}
                                                    onChange={() => toggleLeadSelection(upload.id, lead.id)}
                                                    className="cursor-pointer"
                                                  />
                                                </TableCell>
                                                <TableCell className="font-medium">{lead.lead_company}</TableCell>
                                                <TableCell>{lead.lead_surname || '-'}</TableCell>
                                                <TableCell>{lead.lead_email || '-'}</TableCell>
                                                <TableCell>{lead.lead_number || '-'}</TableCell>
                                                <TableCell>
                                                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                                                    {lead.lead_category || '-'}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="text-xs">{lead.entity_role || '-'}</TableCell>
                                                <TableCell>{lead.lead_city || '-'}</TableCell>
                                                <TableCell>{lead.lead_province || '-'}</TableCell>
                                                <TableCell>
                                                  {lead.website ? (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs">
                                                      Link
                                                    </a>
                                                  ) : '-'}
                                                </TableCell>
                                                <TableCell>
                                                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                                                    {lead.quality_status || '-'}
                                                  </span>
                                                </TableCell>
                                                <TableCell>
                                                  <textarea
                                                    defaultValue={lead.notes || ''}
                                                    onBlur={(e) => {
                                                      const v = e.target.value;
                                                      if (v !== (lead.notes || '')) {
                                                        handleNoteChange(upload.id, lead.id, v);
                                                        updateLeadNotes(lead.id, v);
                                                      }
                                                    }}
                                                    placeholder="Aggiungi nota..."
                                                    rows={2}
                                                    className="w-full min-w-[200px] text-xs p-2 border border-input rounded bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring print:border-0 print:p-0 print:bg-transparent"
                                                    disabled={savingNoteId === lead.id}
                                                  />
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    </CardContent>
                                  )}
                                </Card>
                              );
                            })}
                            
                            <div className="flex justify-center pt-4">
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
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
