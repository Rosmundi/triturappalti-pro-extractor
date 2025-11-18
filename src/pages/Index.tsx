import { useState } from "react";
import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { UploadSection } from "@/components/UploadSection";
import { ResultsSection } from "@/components/ResultsSection";

interface Lead {
  id: string;
  cigAppalto: string;
  descrizioneAppalto: string;
  leadName: string;
  leadEmail: string;
  leadNumber: string;
}

const Index = () => {
  const [extractedLeads, setExtractedLeads] = useState<Lead[]>([]);

  const handleLeadsExtracted = (newLeads: Lead[]) => {
    setExtractedLeads(prev => [...prev, ...newLeads]);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <UploadSection onLeadsExtracted={handleLeadsExtracted} />
        <ResultsSection leads={extractedLeads} onLeadsChange={setExtractedLeads} />
      </main>
      
      <footer className="py-12 border-t border-primary/10 bg-gradient-to-r from-background to-brand-light">
        <div className="container mx-auto px-4 text-center">
          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Il triturappalti</h4>
            <p className="text-muted-foreground">
              Automatizza l'estrazione di lead dai bandi pubblici
            </p>
            <div className="flex justify-center space-x-6 text-sm text-muted-foreground">
              <span>Supporto PDF</span>
              <span>•</span>
              <span>Estrazione automatica</span>
              <span>•</span>
              <span>Export CRM</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;