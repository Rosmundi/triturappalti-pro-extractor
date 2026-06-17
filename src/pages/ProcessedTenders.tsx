import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronRight, Send, Loader2, Trash2, FileText, Briefcase, Users, AlertTriangle, Save, Clock } from "lucide-react";
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
  { key: "company", label: "Azienda", width: 170 },
  { key: "surname", label: "Referente", width: 130 },
  { key: "email", label: "Email", width: 190 },
  { key: "phone", label: "Telefono", width: 120 },
  { key: "category", label: "Categoria", width: 110 },
  { key: "role", label: "Ruolo", width: 130 },
  { key: "address", label: "Indirizzo", width: 220 },
  { key: "web", label: "Web", width: 60 },
  { key: "quality", label: "Qualità", width: 90 },
  { key: "notes", label: "Note", width: 340 },
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
  note_appalto: string | null;
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
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [sendingToCRM, setSendingToCRM] = useState<string | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Record<string, Set<string>>>({});
  const [selectAllPdf, setSelectAllPdf] = useState<Record<string, boolean>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [leadNoteDrafts, setLeadNoteDrafts] = useState<Record<string, string>>({});
  const [tenderNoteDrafts, setTenderNoteDrafts] = useState<Record<string, string>>({});
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
    // Realtime: ricarica quando arrivano/cambiano lead o uploads
    const channel = supabase
      .channel('processed-tenders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchUploads(true))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'uploads' }, () => fetchUploads(true))
      .subscribe();
    // Polling di sicurezza ogni 5s (estrazione asincrona ~60-90s)
    const interval = setInterval(() => fetchUploads(true), 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchUploads = async (silent = false) => {
    if (!silent) setIsLoading(true);
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
                note_appalto: lead.note_appalto ?? null,
                leads: []
              });
            }
            const existingTender = tenderMap.get(projectId)!;
            if (!existingTender.note_appalto && lead.note_appalto) {
              existingTender.note_appalto = lead.note_appalto;
            }
            
            existingTender.leads.push(lead);
          });

          return {
            ...upload,
            leads: leadsData || [],
            tenders: Array.from(tenderMap.values()),
          };
        })
      );

      setUploads(uploadsWithTenders);
    } catch (error) {
      console.error('Errore caricamento appalti:', error);
      if (!silent) {
        toast({
          title: "Errore",
          description: "Impossibile caricare gli appalti elaborati",
          variant: "destructive",
        });
      }
    } finally {
      if (!silent) setIsLoading(false);
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

  const formatNoteTimestamp = (d = new Date()) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const appendDatedNote = (existing: string | null | undefined, entry: string) => {
    const stamped = `[${formatNoteTimestamp()}] ${entry.trim()}`;
    const base = (existing || '').trim();
    return base ? `${base}\n\n${stamped}` : stamped;
  };

  const getLeadVisibleNote = (lead: Pick<Lead, 'note' | 'notes'>) => lead.note || lead.notes || null;

  const applyProjectFilter = (query: any, projectId: string) => {
    return projectId === 'unknown' ? query.is('project_id', null) : query.eq('project_id', projectId);
  };

  const appendLeadNote = async (uploadId: string, leadId: string, currentNote: string | null) => {
    const draft = (leadNoteDrafts[leadId] || '').trim();
    if (!draft) {
      toast({ title: "Nota vuota", description: "Scrivi qualcosa prima di salvare", variant: "destructive" });
      return;
    }
    setSavingNoteId(leadId + ':note');
    try {
      const { data: savedLead, error: readError } = await supabase
        .from('leads')
        .select('note, notes')
        .eq('id', leadId)
        .single();
      if (readError) throw readError;

      const merged = appendDatedNote(savedLead?.note || savedLead?.notes || currentNote, draft);
      const { error } = await supabase.from('leads').update({ note: merged, notes: merged }).eq('id', leadId);
      if (error) throw error;
      // Update local state
      setUploads(prev => prev.map(u => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          leads: u.leads.map(l => l.id === leadId ? { ...l, note: merged, notes: merged } : l),
          tenders: u.tenders.map(t => ({
            ...t,
            leads: t.leads.map(l => l.id === leadId ? { ...l, note: merged, notes: merged } : l),
          })),
        };
      }));
      setLeadNoteDrafts(prev => ({ ...prev, [leadId]: '' }));
    } catch (error) {
      console.error('Errore salvataggio nota:', error);
      toast({ title: "Errore", description: "Impossibile salvare la nota", variant: "destructive" });
    } finally {
      setSavingNoteId(null);
    }
  };

  const appendTenderNote = async (uploadId: string, projectId: string, currentNote: string | null) => {
    const key = uploadId + ':' + projectId;
    const draft = (tenderNoteDrafts[key] || '').trim();
    if (!draft) {
      toast({ title: "Nota vuota", description: "Scrivi qualcosa prima di salvare", variant: "destructive" });
      return;
    }
    setSavingNoteId('tender:' + key);
    try {
      let readQuery = supabase
        .from('leads')
        .select('note_appalto')
        .eq('upload_id', uploadId);
      readQuery = applyProjectFilter(readQuery, projectId);
      const { data: savedTenderNotes, error: readError } = await readQuery;
      if (readError) throw readError;

      const savedCurrentNote = savedTenderNotes?.map(row => row.note_appalto).find(note => note && note.trim()) || currentNote;
      const merged = appendDatedNote(savedCurrentNote, draft);
      let updateQuery = supabase
        .from('leads')
        .update({ note_appalto: merged })
        .eq('upload_id', uploadId);
      updateQuery = applyProjectFilter(updateQuery, projectId);
      const { error } = await updateQuery;
      if (error) throw error;
      setUploads(prev => prev.map(u => {
        if (u.id !== uploadId) return u;
        return {
          ...u,
          leads: u.leads.map(l => l.project_id === projectId ? { ...l, note_appalto: merged } : l),
          tenders: u.tenders.map(t =>
            t.project_id === projectId
              ? { ...t, note_appalto: merged, leads: t.leads.map(l => ({ ...l, note_appalto: merged })) }
              : t
          ),
        };
      }));
      setTenderNoteDrafts(prev => ({ ...prev, [key]: '' }));
    } catch (error) {
      console.error('Errore salvataggio nota appalto:', error);
      toast({ title: "Errore", description: "Impossibile salvare la nota appalto", variant: "destructive" });
    } finally {
      setSavingNoteId(null);
    }
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
          // New fields (tender + lead extras + manual notes)
          nome_appalto: lead.nome_appalto ?? tender?.nome_appalto ?? "",
          categoria_progetto: lead.categoria_progetto ?? "",
          tipo_intervento: lead.tipo_intervento ?? tender?.tipo_intervento ?? "",
          committente_tipo: lead.committente_tipo ?? tender?.committente_tipo ?? "",
          categorie_og: lead.categorie_og ?? tender?.categorie_og ?? "",
          procedura_gara: lead.procedura_gara ?? tender?.procedura_gara ?? "",
          finanziamento: lead.finanziamento ?? tender?.finanziamento ?? "",
          data_appalto: lead.data_appalto ?? tender?.data_appalto ?? "",
          data_fine_lavori: lead.data_fine_lavori ?? tender?.data_fine_lavori ?? "",
          termine_offerta: lead.termine_offerta ?? tender?.termine_offerta ?? "",
          note: lead.note ?? "",
          note_appalto: lead.note_appalto ?? "",
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
                const safeTenders = upload.tenders ?? [];
                const safeLeads = upload.leads ?? [];
                const totalTenders = safeTenders.length;
                const totalLeads = safeLeads.length;
                const isProcessing = totalLeads === 0;
                
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
                              {isProcessing && (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  In elaborazione…
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={safeLeads.length > 0 && safeLeads.every(l => selectedLeads[upload.id]?.has(l.id))}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelectAllPdf(upload.id, safeLeads);
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
                        {safeTenders.length === 0 ? (
                          <div className="flex items-center justify-center gap-2 text-muted-foreground py-6">
                            {isProcessing ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Estrazione in corso… (ricaricamento automatico)</span>
                              </>
                            ) : (
                              <span>Nessun appalto trovato</span>
                            )}
                          </div>
                        ) : (
                          <>
                            {safeTenders.map((tender) => {
                              const isTenderExpanded = expandedTenders[upload.id]?.has(tender.project_id);
                              const tenderLeads = tender.leads ?? [];
                              const tenderLeadIds = tenderLeads.map(l => l.id);
                              const selectedCount = tenderLeadIds.filter(id => 
                                selectedLeads[upload.id]?.has(id)
                              ).length;
                              const allTenderSelected = selectedCount === tenderLeads.length && tenderLeads.length > 0;
                              const descKey = upload.id + ':' + tender.project_id;
                              const isDescExpanded = expandedDescriptions.has(descKey);
                              
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
                                          <div className="text-lg font-semibold leading-tight">{tender.nome_appalto || tender.descrizione_appalto || 'Appalto senza nome'}</div>
                                          <div className="text-xs text-muted-foreground space-x-3">
                                            {tender.appalto_location && <span><strong>Località:</strong> {tender.appalto_location}</span>}
                                            {tender.value_eur && <span><strong>Valore:</strong> €{parseInt(tender.value_eur).toLocaleString()}</span>}
                                            {tender.phase && <span><strong>Fase:</strong> {tender.phase}</span>}
                                            {tender.tipo_intervento && <span><strong>Intervento:</strong> {tender.tipo_intervento}</span>}
                                            {tender.committente_tipo && <span><strong>Committente:</strong> {tender.committente_tipo}</span>}
                                            <span><strong>Contatti:</strong> {tenderLeads.length}</span>
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
                                       {/* Dettagli appalto */}
                                       <div className="mb-4 rounded-md border bg-muted/40 p-3">
                                         <div className="text-sm font-semibold mb-2">Dettagli appalto</div>
                                         {(() => {
                                           const cat_progetto = tenderLeads.find(l => l.categoria_progetto)?.categoria_progetto || null;
                                           const fields: Array<[string, string | null]> = [
                                             ['Categoria progetto', cat_progetto],
                                             ['Categorie OG', tender.categorie_og],
                                             ['CIG', tender.cig_appalto],
                                             ['CUP', tender.cup],
                                             ['Procedura', tender.procedura_gara],
                                             ['Finanziamento', tender.finanziamento],
                                             ['Appalto', tender.data_appalto],
                                             ['Fine lavori', tender.data_fine_lavori],
                                             ['Termine offerta', tender.termine_offerta],
                                             ['ID progetto', tender.project_id !== 'unknown' ? tender.project_id : null],
                                           ];
                                           const visible = fields.filter(([, v]) => v && String(v).trim() !== '');
                                           if (visible.length === 0) return null;
                                           return (
                                             <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-xs mb-3">
                                               {visible.map(([label, value]) => (
                                                 <div key={label}><span className="text-muted-foreground">{label}:</span> <strong className="break-all">{value}</strong></div>
                                               ))}
                                             </div>
                                           );
                                         })()}
                                         {tender.descrizione_appalto && (
                                           <div className="mb-3">
                                             <div className="text-xs font-semibold text-muted-foreground mb-1">Descrizione</div>
                                             <div className={"text-sm whitespace-pre-wrap " + (isDescExpanded ? "" : "line-clamp-3")}>
                                               {tender.descrizione_appalto}
                                             </div>
                                             {tender.descrizione_appalto.length > 180 && (
                                               <button
                                                 type="button"
                                                 onClick={() => {
                                                   setExpandedDescriptions(prev => {
                                                     const next = new Set(prev);
                                                     if (next.has(descKey)) next.delete(descKey);
                                                     else next.add(descKey);
                                                     return next;
                                                   });
                                                 }}
                                                 className="text-xs text-primary hover:underline mt-1 print:hidden"
                                               >
                                                 {isDescExpanded ? 'Mostra meno' : 'Mostra tutto'}
                                               </button>
                                             )}
                                           </div>
                                         )}
                                          <div>
                                            <div className="text-xs font-semibold text-muted-foreground mb-1">Note appalto</div>
                                            {tender.note_appalto && tender.note_appalto.trim() ? (
                                              <div className="mb-2 text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded p-2 max-h-40 overflow-y-auto">
                                                {tender.note_appalto}
                                              </div>
                                            ) : (
                                              <div className="mb-2 text-xs text-muted-foreground italic">Nessuna nota</div>
                                            )}
                                            <textarea
                                              value={tenderNoteDrafts[upload.id + ':' + tender.project_id] || ''}
                                              onChange={(e) => setTenderNoteDrafts(prev => ({ ...prev, [upload.id + ':' + tender.project_id]: e.target.value }))}
                                              placeholder="Aggiungi una nuova nota..."
                                              rows={2}
                                              className="w-full min-h-[60px] text-sm p-2 border border-input rounded bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring print:hidden"
                                              disabled={savingNoteId === 'tender:' + upload.id + ':' + tender.project_id}
                                            />
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() => appendTenderNote(upload.id, tender.project_id, tender.note_appalto)}
                                              disabled={savingNoteId === 'tender:' + upload.id + ':' + tender.project_id}
                                              className="mt-1 h-7 gap-1 print:hidden"
                                            >
                                              {savingNoteId === 'tender:' + upload.id + ':' + tender.project_id ? (
                                                <><Loader2 className="h-3 w-3 animate-spin" />Salvataggio...</>
                                              ) : (
                                                <><Save className="h-3 w-3" />Aggiungi nota datata</>
                                              )}
                                            </Button>
                                          </div>
                                       </div>
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
                                             {tenderLeads.map((lead) => (
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
                                                <TableCell className="break-words overflow-hidden text-xs leading-tight">
                                                  {(() => {
                                                    const line1 = lead.street || '';
                                                    const cityBits = [lead.cap, lead.lead_city].filter(Boolean).join(' ');
                                                    const line2 = [cityBits, lead.lead_province, lead.country].filter(Boolean).join(' · ');
                                                    if (!line1 && !line2) return '-';
                                                    return (
                                                      <div className="space-y-0.5">
                                                        {line1 && <div>{line1}</div>}
                                                        {line2 && <div className="text-muted-foreground">{line2}</div>}
                                                      </div>
                                                    );
                                                  })()}
                                                </TableCell>
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
                                                  <div className="space-y-2">
                                                    <div>
                                                      <div className="text-[10px] font-semibold text-muted-foreground mb-1 print:hidden">Note contatto</div>
                                                      {lead.note && lead.note.trim() ? (
                                                        <div className="mb-1 text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded p-1.5 max-h-32 overflow-y-auto leading-snug">
                                                          {lead.note}
                                                        </div>
                                                      ) : (
                                                        <div className="mb-1 text-[11px] text-muted-foreground italic print:hidden">Nessuna nota</div>
                                                      )}
                                                      <textarea
                                                        value={leadNoteDrafts[lead.id] || ''}
                                                        onChange={(e) => setLeadNoteDrafts(prev => ({ ...prev, [lead.id]: e.target.value }))}
                                                        placeholder="Aggiungi una nuova nota..."
                                                        rows={2}
                                                        className="w-full min-h-[50px] text-sm p-2 border border-input rounded bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring print:hidden"
                                                        disabled={savingNoteId === lead.id + ':note'}
                                                      />
                                                      <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => appendLeadNote(upload.id, lead.id, lead.note)}
                                                        disabled={savingNoteId === lead.id + ':note'}
                                                        className="mt-1 h-7 w-full gap-1 print:hidden"
                                                      >
                                                        {savingNoteId === lead.id + ':note' ? (
                                                          <><Loader2 className="h-3 w-3 animate-spin" />Salvataggio...</>
                                                        ) : (
                                                          <><Save className="h-3 w-3" />Aggiungi nota datata</>
                                                        )}
                                                      </Button>
                                                    </div>
                                                  </div>
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
