import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Send, FileSpreadsheet } from "lucide-react";
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
  cigAppalto: string;
  descrizioneAppalto: string;
  leadName: string;
  leadEmail: string;
  leadNumber: string;
}

interface ResultsSectionProps {
  leads: Lead[];
  onLeadsChange: (leads: Lead[]) => void;
}

export const ResultsSection = ({ leads = [], onLeadsChange }: ResultsSectionProps) => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  if (!leads || leads.length === 0) {
    return null;
  }

  const sendToCRM = async () => {
    setIsExporting(true);

    try {
      const response = await fetch(WEBHOOKS.CONFERMA_INVIO_CRM, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ leads }),
      });

      if (!response.ok) {
        throw new Error('Errore durante l\'invio al CRM');
      }

      toast({
        title: "Lead inviati al CRM",
        description: `${leads.length} lead sono stati inviati con successo`,
      });
    } catch (error) {
      console.error('Errore invio CRM:', error);
      toast({
        title: "Errore",
        description: "Impossibile inviare i lead al CRM",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportToGoogleSheets = () => {
    const headers = [
      'CIG Appalto',
      'Descrizione Appalto',
      'Lead Name',
      'Lead Email',
      'Lead Number'
    ];
    
    const csvContent = [
      headers.join(','),
      ...leads.map(lead => [
        `"${lead.cigAppalto}"`,
        `"${lead.descrizioneAppalto}"`,
        `"${lead.leadName}"`,
        lead.leadEmail,
        lead.leadNumber
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "CSV Scaricato",
      description: "Il file è pronto per essere importato in Google Sheets",
    });
  };

  return (
    <section className="py-16 bg-background" data-section="results">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h3 className="text-3xl font-bold mb-2">Lead estratti</h3>
            <p className="text-muted-foreground">
              {leads.length} contatt{leads.length === 1 ? 'o' : 'i'} elaborat{leads.length === 1 ? 'o' : 'i'}
            </p>
          </div>

          <Card className="p-6 mb-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CIG Appalto</TableHead>
                    <TableHead>Descrizione Appalto</TableHead>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Lead Email</TableHead>
                    <TableHead>Lead Number</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">{lead.cigAppalto}</TableCell>
                      <TableCell>{lead.descrizioneAppalto}</TableCell>
                      <TableCell>{lead.leadName}</TableCell>
                      <TableCell>{lead.leadEmail}</TableCell>
                      <TableCell>{lead.leadNumber}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={exportToGoogleSheets}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Scarica CSV
            </Button>
            <Button 
              onClick={sendToCRM}
              disabled={isExporting}
              size="lg"
            >
              <Send className="h-4 w-4 mr-2" />
              {isExporting ? "Invio in corso..." : "Invia lead al CRM"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
