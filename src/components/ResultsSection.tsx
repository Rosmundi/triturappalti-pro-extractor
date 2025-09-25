import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  User, 
  Euro, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  Edit, 
  Save,
  X,
  Send
} from "lucide-react";

interface Lead {
  id: string;
  // Dati dell'appalto (costanti per tutti i lead dello stesso PDF)
  project: string;
  client: string;
  amount: string;
  deadline: string;
  projectId: string;
  category: string;
  location: string;
  // Dati del singolo progettista/lead
  designerName: string;
  designerType: string; // architetto, ingegnere, geologo, etc.
  designerCompany: string;
  designerEmail?: string;
  designerPhone?: string;
  designerAddress?: string;
  status: 'nuovo' | 'contattato' | 'interessato' | 'non_interessato';
  notes?: string;
  sourceFile: string; // nome del PDF da cui è stato estratto
}

const mockLeads: Lead[] = [
  // Lead dal Centro salute mentale
  {
    id: "1",
    project: "Centro salute mentale",
    client: "V.le Cittadini 52100 Arezzo (AR)",
    amount: "€1.685.000",
    deadline: "2027/06",
    projectId: "PRJ-2024-001",
    category: "Ospedali",
    location: "Arezzo, Toscana",
    designerName: "Caneschi Alessandro",
    designerType: "Architetto",
    designerCompany: "Studio Caneschi & Associati",
    designerEmail: "a.caneschi@studioarch.it",
    designerPhone: "+39055752551",
    designerAddress: "Via Roma 12, Arezzo",
    status: "nuovo",
    notes: "Responsabile della progettazione architettonica",
    sourceFile: "bando_centro_salute_mentale.pdf"
  },
  {
    id: "2",
    project: "Centro salute mentale", 
    client: "V.le Cittadini 52100 Arezzo (AR)",
    amount: "€1.685.000",
    deadline: "2027/06",
    projectId: "PRJ-2024-001",
    category: "Ospedali",
    location: "Arezzo, Toscana",
    designerName: "Martini Francesco",
    designerType: "Ingegnere Strutturale",
    designerCompany: "Ingegneria Strutturale Toscana",
    designerEmail: "f.martini@iststrutturale.it",
    designerPhone: "+39055987654",
    status: "nuovo",
    sourceFile: "bando_centro_salute_mentale.pdf"
  },
  {
    id: "3",
    project: "Centro salute mentale",
    client: "V.le Cittadini 52100 Arezzo (AR)", 
    amount: "€1.685.000",
    deadline: "2027/06",
    projectId: "PRJ-2024-001",
    category: "Ospedali",
    location: "Arezzo, Toscana",
    designerName: "Bianca Rossi",
    designerType: "Ingegnere Impiantista",
    designerCompany: "Impianti Moderni SRL",
    designerEmail: "b.rossi@impiantimoderni.it",
    status: "nuovo",
    sourceFile: "bando_centro_salute_mentale.pdf"
  },
  // Lead dall'ospedale pediatrico
  {
    id: "4",
    project: "Ristrutturazione ospedale pediatrico",
    client: "ASL Toscana Centro",
    amount: "€2.450.000",
    deadline: "2026/12",
    projectId: "PRJ-2024-002",
    category: "Ospedali",
    location: "Firenze, Toscana",
    designerName: "Marco Bianchi",
    designerType: "Architetto",
    designerCompany: "Bianchi Architettura",
    designerEmail: "m.bianchi@bianchiarc.it",
    designerPhone: "+39055123456",
    status: "nuovo",
    notes: "Specializzato in strutture sanitarie pediatriche",
    sourceFile: "bando_ospedale_pediatrico.pdf"
  },
  {
    id: "5", 
    project: "Ristrutturazione ospedale pediatrico",
    client: "ASL Toscana Centro",
    amount: "€2.450.000", 
    deadline: "2026/12",
    projectId: "PRJ-2024-002",
    category: "Ospedali",
    location: "Firenze, Toscana",
    designerName: "Laura Verdi",
    designerType: "Ingegnere Biomedico",
    designerCompany: "Biotech Engineering",
    designerEmail: "l.verdi@biotech.it",
    status: "nuovo",
    sourceFile: "bando_ospedale_pediatrico.pdf"
  }
];

export const ResultsSection = () => {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const clearAllLeads = () => {
    setLeads([]);
    toast({
      title: "Lista azzerata",
      description: "Tutti i lead sono stati rimossi",
    });
  };

  const startEditing = (id: string) => {
    setEditingId(id);
  };

  const saveEditing = () => {
    setEditingId(null);
    toast({
      title: "Modifiche salvate",
      description: "I dati del lead sono stati aggiornati",
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const updateLead = (id: string, field: keyof Lead, value: string) => {
    setLeads(prev => prev.map(lead => 
      lead.id === id ? { ...lead, [field]: value } : lead
    ));
  };

  const exportToWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Errore",
        description: "Inserisci l'URL del webhook",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          leads,
          timestamp: new Date().toISOString(),
          source: "Il triturappalti"
        }),
      });

      toast({
        title: "Export completato",
        description: `${leads.length} lead inviati al webhook`,
      });
    } catch (error) {
      toast({
        title: "Errore export",
        description: "Impossibile inviare i dati al webhook",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToGoogleSheets = () => {
    const csvContent = [
      ["Progetto", "Cliente", "ID Progetto", "Importo", "Scadenza", "Progettista", "Tipologia", "Azienda", "Email", "Telefono", "Indirizzo", "Status", "Note", "File Origine"],
      ...leads.map(lead => [
        lead.project,
        lead.client,
        lead.projectId,
        lead.amount,
        lead.deadline,
        lead.designerName,
        lead.designerType,
        lead.designerCompany,
        lead.designerEmail || "",
        lead.designerPhone || "",
        lead.designerAddress || "",
        lead.status,
        lead.notes || "",
        lead.sourceFile
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "progettisti-appalti.csv";
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV generato",
      description: "File progettisti scaricato - importalo in Google Sheets",
    });
  };

  if (leads.length === 0) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-3xl font-bold">Progettisti estratti</h3>
              <Button 
                variant="outline" 
                onClick={clearAllLeads}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Azzera lista
              </Button>
            </div>
            <p className="text-muted-foreground text-lg">
              Controlla e modifica i dati dei progettisti prima dell'export
            </p>
          </div>

          <div className="grid gap-6 mb-8">
            {leads.map((lead) => (
              <Card key={lead.id} className="p-6 hover:shadow-card transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {editingId === lead.id ? (
                      <Input
                        value={lead.project}
                        onChange={(e) => updateLead(lead.id, 'project', e.target.value)}
                        className="text-xl font-bold mb-2"
                      />
                    ) : (
                      <h4 className="text-xl font-bold mb-2">{lead.project}</h4>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary">{lead.category}</Badge>
                      <Badge variant="outline">{lead.projectId}</Badge>
                      <Badge variant="outline" className="text-xs">{lead.sourceFile}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">{lead.client}</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {editingId === lead.id ? (
                      <>
                        <Button variant="ghost" size="sm" onClick={saveEditing}>
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={cancelEditing}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => startEditing(lead.id)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <Separator className="mb-4" />
                
                {/* Sezione Progettista */}
                <div className="bg-primary/5 p-4 rounded-lg mb-4">
                  <h5 className="font-semibold mb-3 text-primary">📋 Progettista</h5>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Nome</Label>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.designerName}
                          onChange={(e) => updateLead(lead.id, 'designerName', e.target.value)}
                        />
                      ) : (
                        <p className="font-medium">{lead.designerName}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Tipologia</Label>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.designerType}
                          onChange={(e) => updateLead(lead.id, 'designerType', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm font-medium text-accent">{lead.designerType}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Azienda/Studio</Label>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.designerCompany}
                          onChange={(e) => updateLead(lead.id, 'designerCompany', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{lead.designerCompany}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Email</Label>
                      </div>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.designerEmail || ""}
                          onChange={(e) => updateLead(lead.id, 'designerEmail', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{lead.designerEmail || "N/A"}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        <Label className="text-sm font-medium">Telefono</Label>
                      </div>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.designerPhone || ""}
                          onChange={(e) => updateLead(lead.id, 'designerPhone', e.target.value)}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{lead.designerPhone || "N/A"}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Status</Label>
                      {editingId === lead.id ? (
                        <Input
                          value={lead.status}
                          onChange={(e) => updateLead(lead.id, 'status', e.target.value as any)}
                        />
                      ) : (
                        <Badge variant={lead.status === 'nuovo' ? 'secondary' : 'outline'}>
                          {lead.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sezione Appalto */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Euro className="h-4 w-4 text-accent" />
                      <Label className="text-sm font-medium">Importo</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.amount}
                        onChange={(e) => updateLead(lead.id, 'amount', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm font-bold text-accent">{lead.amount}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Luogo</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.location}
                        onChange={(e) => updateLead(lead.id, 'location', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{lead.location}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Scadenza</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.deadline}
                        onChange={(e) => updateLead(lead.id, 'deadline', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{lead.deadline}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-6">
            <h4 className="text-lg font-semibold mb-4">Esporta i lead</h4>
            <div className="grid md:grid-copies-2 gap-6">
              <div className="space-y-4">
                <Label htmlFor="webhook">Webhook URL (n8n o altro)</Label>
                <Input
                  id="webhook"
                  placeholder="https://your-webhook-url.com"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
                <Button 
                  variant="hero" 
                  onClick={exportToWebhook}
                  disabled={isExporting}
                  className="w-full"
                >
                  <Send className="h-4 w-4" />
                  {isExporting ? "Invio in corso..." : "Invia a Webhook"}
                </Button>
              </div>
              
              <div className="space-y-4">
                <Label>Esporta in Google Sheets</Label>
                <p className="text-sm text-muted-foreground">
                  Scarica un file CSV che puoi importare direttamente in Google Sheets
                </p>
                <Button 
                  variant="professional" 
                  onClick={exportToGoogleSheets}
                  className="w-full"
                >
                  Scarica CSV
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
};