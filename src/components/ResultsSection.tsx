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
  project: string;
  client: string;
  responsible: string;
  contractor: string;
  amount: string;
  location: string;
  deadline: string;
  email?: string;
  phone?: string;
  category: string;
  status: string;
}

const mockLeads: Lead[] = [
  {
    id: "1",
    project: "Centro salute mentale",
    client: "V.le Cittadini 52100 Arezzo (AR)",
    responsible: "Caneschi Alessandro",
    contractor: "FS Costruzioni srl",
    amount: "€1.685.000",
    location: "Arezzo, Toscana",
    deadline: "2027/06",
    email: "urp.arezzo@uslsudest.toscana.it",
    phone: "+39055752551",
    category: "Ospedali",
    status: "Fase Esecuzione"
  },
  {
    id: "2", 
    project: "Ristrutturazione ospedale pediatrico",
    client: "ASL Toscana Centro",
    responsible: "Rossi Maria",
    contractor: "Edil Toscana SpA",
    amount: "€2.450.000",
    location: "Firenze, Toscana", 
    deadline: "2026/12",
    email: "gare@asltoscanacentro.it",
    phone: "+39055123456",
    category: "Ospedali",
    status: "Progettazione"
  }
];

export const ResultsSection = () => {
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

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
      ["Progetto", "Cliente", "Responsabile", "Appaltatore", "Importo", "Luogo", "Scadenza", "Email", "Telefono", "Categoria", "Stato"],
      ...leads.map(lead => [
        lead.project,
        lead.client, 
        lead.responsible,
        lead.contractor,
        lead.amount,
        lead.location,
        lead.deadline,
        lead.email || "",
        lead.phone || "",
        lead.category,
        lead.status
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "leads-appalti.csv";
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "CSV generato",
      description: "File scaricato - importalo in Google Sheets",
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
            <h3 className="text-3xl font-bold mb-4">Lead estratti</h3>
            <p className="text-muted-foreground text-lg">
              Controlla e modifica i dati prima dell'export
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
                    <div className="flex items-center gap-2 mb-4">
                      <Badge variant="secondary">{lead.category}</Badge>
                      <Badge variant="outline">{lead.status}</Badge>
                    </div>
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

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Cliente</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.client}
                        onChange={(e) => updateLead(lead.id, 'client', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{lead.client}</p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Responsabile</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.responsible}
                        onChange={(e) => updateLead(lead.id, 'responsible', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{lead.responsible}</p>
                    )}
                  </div>

                  <div className="space-y-3">
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

                  <div className="space-y-3">
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

                  <div className="space-y-3">
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

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" />
                      <Label className="text-sm font-medium">Email</Label>
                    </div>
                    {editingId === lead.id ? (
                      <Input
                        value={lead.email || ""}
                        onChange={(e) => updateLead(lead.id, 'email', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{lead.email || "N/A"}</p>
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