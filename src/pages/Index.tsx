import { Header } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { UploadSection } from "@/components/UploadSection";
import { ResultsSection } from "@/components/ResultsSection";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <HeroSection />
        <UploadSection />
        <ResultsSection />
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