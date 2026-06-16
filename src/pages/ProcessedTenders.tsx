import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Send, Loader2, Trash2, FileText, Briefcase, Users, AlertTriangle, Save } from "lucide-react";
import { FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
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

const COLUMN_DEFS = [
  { key: "select", label: "", width: 36 },
  { key: "company", label: "Azienda", width: 160 },
  { key: "surname", label: "Referente", width: 110 },
  { key: "email", label: "Email", width: 180 },
  { key: "phone", label: "Telefono", width: 110 },
  { key: "category", label: "Categoria", width: 110 },
  { key: "role", label: "Ruolo", width: 110 },
  { key: "city", label: "Città", width: 100 },
  { key: "province", label: "Prov.", width: 60 },
  { key: "web", label: "Web", width: 60 },
  { key: "quality", label: "Qualità", width: 90 },
  { key: "notes", label: "Note", width: 320 },
] as const;

type ColKey = (typeof COLUMN_DEFS)[number]["key"];
const COL_WIDTHS_STORAGE_KEY = "appalti.colWidths.v1";

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
  note: string | null;
  note_appalto: string | null;
  nome_appalto: string | null;
  categoria_progetto: string | null;
  tipo_intervento: string | null;
  committente_tipo: string | null;
  categorie_og: string | null;
  procedura_gara: string | null;
  finanziamento: string | null;
  data_appalto: string | null;
  data_fine_lavori: string | null;
  termine_offerta: string | null;
}

interface Tender {
  project_id: string;
  cig_appalto: string | null;
  descrizione_appalto: string | null;
  value_eur: string | null;
  phase: string | null;
  cup: string | null;
  appalto_location: string | null;
  nome_appalto: string | null;
  categorie_og: string | null;
  tipo_intervento: string | null;
  committente_tipo: string | null;
  procedura_gara: string | null;
  finanziamento: string | null;
  data_appalto: string | null;
  data_fine_lavori: string | null;
  termine_offerta: string | null;
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

  const [colWidths, setColWidths] = useState<Record<ColKey, number>>(() => {
    const defaults = COLUMN_DEFS.reduce((acc, c) => {
      acc[c.key] = c.width;
      return acc;
    }, {} as Record<ColKey, number>);
    try {
      const raw = localStorage.getItem(COL_WIDTHS_STORAGE_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return defaults;
  });

  useEffect(() => {
    try {
      localStorage.setItem(COL_WIDTHS_STORAGE_KEY, JSON.stringify(colWidths));
    } catch {
      /* ignore */
    }
  }, [colWidths]);

  const startResize = (key: ColKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[key];
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(40, startWidth + (ev.clientX - startX));
      setColWidths((prev) => ({ ...prev, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

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
                nome_appalto: lead.nome_appalto ?? null,
                categorie_og: lead.categorie_og ?? null,
                tipo_intervento: lead.tipo_intervento ?? null,
                committente_tipo: lead.committente_tipo ?? null,
                procedura_gara: lead.procedura_gara ?? null,
                finanziamento: lead.finanziamento ?? null,
                data_appalto: lead.data_appalto ?? null,
                data_fine_lavori: lead.data_fine_lavori ?? null,
                termine_offerta: lead.termine_offerta ?? null,
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

  const updateLeadField = async (
    leadId: string,
    field: 'note' | 'note_appalto' | 'notes',
    value: string
  ) => {
    setSavingNoteId(leadId + ':' + field);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ [field]: value })
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

  const handleLeadFieldChange = (
    uploadId: string,
    leadId: string,
    field: 'note' | 'note_appalto',
    value: string
  ) => {
    setUploads(prev => prev.map(u => {
      if (u.id !== uploadId) return u;
      return {
        ...u,
        leads: u.leads.map(l => l.id === leadId ? { ...l, [field]: value } : l),
        tenders: u.tenders.map(t => ({
          ...t,
          leads: t.leads.map(l => l.id === leadId ? { ...l, [field]: value } : l),
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

  const exportToExcel = (upload: Upload) => {
    try {
      const rows = upload.leads.map((lead) => {
        const tender = upload.tenders.find((t) => t.leads.some((l) => l.id === lead.id));
        return {
          "File": upload.filename,
          "Data caricamento": new Date(upload.uploaded_at).toLocaleString("it-IT"),
          "Stato": upload.status,
          "Upload ID": upload.id,
          "Project ID": lead.project_id || tender?.project_id || "",
          "CIG Appalto": tender?.cig_appalto || lead.cig_appalto || "",
          "CUP": tender?.cup || lead.cup || "",
          "Descrizione Appalto": tender?.descrizione_appalto || lead.descrizione_appalto || "",
          "Valore (EUR)": tender?.value_eur || lead.value_eur || "",
          "Fase": tender?.phase || lead.phase || "",
          "Località Appalto": tender?.appalto_location || lead.appalto_location || "",
          "Azienda": lead.lead_company || "",
          "Referente": lead.lead_surname || "",
          "Email": lead.lead_email || "",
          "Telefono": lead.lead_number || "",
          "Categoria": lead.lead_category || "",
          "Ruolo": lead.entity_role || "",
          "Qualità": lead.quality_status || "",
          "Website": lead.website || "",
          "Indirizzo": lead.street || "",
          "CAP": lead.cap || "",
          "Città": lead.lead_city || "",
          "Provincia": lead.lead_province || "",
          "Paese": lead.country || "",
          "Note": lead.notes || "",
          "Lead ID": lead.id,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      // Auto-size columns based on header / values
      const headers = Object.keys(rows[0] || { "Nessun dato": "" });
      ws["!cols"] = headers.map((h) => {
        const maxLen = Math.max(
          h.length,
          ...rows.map((r) => String((r as Record<string, unknown>)[h] ?? "").length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Appalto");

      const safeName = upload.filename.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "_");
      XLSX.writeFile(wb, `appalto_${safeName}.xlsx`);

      toast({
        title: "Esportazione completata",
        description: `File Excel scaricato (${rows.length} lead)`,
      });
    } catch (error) {
      console.error("Errore esportazione Excel:", error);
      toast({
        title: "Errore",
        description: "Impossibile esportare in Excel",
        variant: "destructive",
      });
    }
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
          ...lead,
          notes: lead.notes ?? "",
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              exportToExcel(upload);
                            }}
                            className="text-green-700 hover:text-green-800 hover:bg-green-100 print:hidden"
                            title="Esporta appalto in Excel"
                          >
                            <FileSpreadsheet className="h-4 w-4" />
                          </Button>
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
                                        <Table className="text-xs [&_th]:px-2 [&_th]:h-9 [&_td]:p-2 table-fixed">
                                          <colgroup>
                                            {COLUMN_DEFS.map((c) => (
                                              <col key={c.key} style={{ width: colWidths[c.key] }} />
                                            ))}
                                          </colgroup>
                                          <TableHeader>
                                            <TableRow>
                                              {COLUMN_DEFS.map((c) => (
                                                <TableHead
                                                  key={c.key}
                                                  className="relative select-none overflow-hidden whitespace-nowrap"
                                                >
                                                  {c.key === "select" ? (
                                                    <Users className="h-4 w-4" />
                                                  ) : (
                                                    <span className="block truncate pr-2">{c.label}</span>
                                                  )}
                                                  <span
                                                    onMouseDown={(e) => startResize(c.key, e)}
                                                    className="absolute top-1 right-0 h-[calc(100%-0.5rem)] w-1 cursor-col-resize bg-border hover:bg-primary hover:w-1.5 active:bg-primary active:w-1.5 transition-all print:hidden"
                                                    title="Trascina per ridimensionare"
                                                  />
                                                </TableHead>
                                              ))}
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
                                                <TableCell className="font-medium break-words overflow-hidden">{lead.lead_company}</TableCell>
                                                <TableCell className="break-words overflow-hidden">{lead.lead_surname || '-'}</TableCell>
                                                <TableCell className="break-all overflow-hidden">{lead.lead_email || '-'}</TableCell>
                                                <TableCell className="break-words overflow-hidden">{lead.lead_number || '-'}</TableCell>
                                                <TableCell className="overflow-hidden">
                                                  <span className="bg-secondary px-1.5 py-0.5 rounded break-words inline-block">
                                                    {lead.lead_category || '-'}
                                                  </span>
                                                </TableCell>
                                                <TableCell className="break-words overflow-hidden">{lead.entity_role || '-'}</TableCell>
                                                <TableCell className="break-words overflow-hidden">{lead.lead_city || '-'}</TableCell>
                                                <TableCell className="break-words overflow-hidden">{lead.lead_province || '-'}</TableCell>
                                                <TableCell className="overflow-hidden">
                                                  {lead.website ? (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                      Link
                                                    </a>
                                                  ) : '-'}
                                                </TableCell>
                                                <TableCell className="overflow-hidden">
                                                  <span className="bg-green-100 text-green-800 px-1.5 py-0.5 rounded break-words inline-block">
                                                    {lead.quality_status || '-'}
                                                  </span>
                                                </TableCell>
                                                <TableCell>
                                                  <textarea
                                                    value={lead.notes || ''}
                                                    onChange={(e) =>
                                                      handleNoteChange(upload.id, lead.id, e.target.value)
                                                    }
                                                    placeholder="Aggiungi nota..."
                                                    rows={4}
                                                    className="w-full min-h-[90px] text-sm p-2 border border-input rounded bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring print:border-0 print:p-0 print:bg-transparent"
                                                    disabled={savingNoteId === lead.id}
                                                  />
                                                  <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => updateLeadNotes(lead.id, lead.notes || '')}
                                                    disabled={savingNoteId === lead.id}
                                                    className="mt-1 h-7 w-full gap-1 print:hidden"
                                                  >
                                                    {savingNoteId === lead.id ? (
                                                      <>
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                        Salvataggio...
                                                      </>
                                                    ) : (
                                                      <>
                                                        <Save className="h-3 w-3" />
                                                        Salva nota
                                                      </>
                                                    )}
                                                  </Button>
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
