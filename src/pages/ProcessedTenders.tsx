import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, ChevronUp, Send, Loader2 } from "lucide-react";
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
}

interface Upload {
  id: string;
  filename: string;
  uploaded_at: string;
  status: string;
  cig_appalto: string | null;
  descrizione_appalto: string | null;
  leads: Lead[];
}

export default function ProcessedTenders() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [expandedUploadId, setExpandedUploadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingToCRM, setSendingToCRM] = useState<string | null>(null);
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

  const sendToCRM = async (upload: Upload) => {
    setSendingToCRM(upload.id);
    try {
      const response = await fetch(WEBHOOKS.CONFERMA_INVIO_CRM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          upload_id: upload.id,
          cig_appalto: upload.cig_appalto,
          descrizione_appalto: upload.descrizione_appalto,
          leads: upload.leads 
        }),
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'invio al CRM');
      }

      toast({
        title: "Lead inviati al CRM",
        description: `${upload.leads.length} lead sono stati inviati con successo`,
      });
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
                    onClick={() => toggleExpand(upload.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl mb-2">{upload.filename}</CardTitle>
                        <div className="text-sm text-muted-foreground space-y-1">
                          {upload.cig_appalto && (
                            <p><strong>CIG:</strong> {upload.cig_appalto}</p>
                          )}
                          {upload.descrizione_appalto && (
                            <p><strong>Descrizione:</strong> {upload.descrizione_appalto}</p>
                          )}
                          <p><strong>Caricato:</strong> {new Date(upload.uploaded_at).toLocaleString('it-IT')}</p>
                          <p><strong>Lead trovati:</strong> {upload.leads.length}</p>
                        </div>
                      </div>
                      {expandedUploadId === upload.id ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </CardHeader>
                  
                  {expandedUploadId === upload.id && (
                    <CardContent>
                      {upload.leads.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4">Nessun lead trovato</p>
                      ) : (
                        <>
                          <div className="overflow-x-auto mb-4">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Nome Lead</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>Numero</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {upload.leads.map((lead) => (
                                  <TableRow key={lead.id}>
                                    <TableCell className="font-medium">{lead.lead_name}</TableCell>
                                    <TableCell>{lead.lead_email || '-'}</TableCell>
                                    <TableCell>{lead.lead_number || '-'}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          
                          <div className="flex justify-end">
                            <Button
                              onClick={() => sendToCRM(upload)}
                              disabled={sendingToCRM === upload.id}
                              className="gap-2"
                            >
                              {sendingToCRM === upload.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Invio in corso...
                                </>
                              ) : (
                                <>
                                  <Send className="h-4 w-4" />
                                  Invia lead al CRM
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
