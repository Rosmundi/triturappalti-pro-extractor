import { Button } from "@/components/ui/button";
import { Upload, FileText, Users, BarChart3 } from "lucide-react";
import heroImage from "@/assets/hero-image.jpg";

export const HeroSection = () => {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-brand-light to-background" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-5xl lg:text-6xl font-bold">
                <span className="bg-gradient-to-r from-primary via-accent to-primary-glow bg-clip-text text-transparent">
                  Tritura
                </span>{" "}
                i tuoi appalti
              </h2>
              <p className="text-xl text-muted-foreground leading-relaxed">
                Carica i PDF dei bandi pubblici e ottieni automaticamente tutti i lead 
                estratti e pronti per il tuo CRM. Risparmia ore di lavoro manuale.
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="hero" 
                size="lg" 
                className="text-lg px-8 py-3"
                onClick={() => {
                  const uploadSection = document.querySelector('section[data-section="upload"]');
                  uploadSection?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <Upload className="h-5 w-5" />
                Inizia subito
              </Button>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-8 border-t border-primary/10">
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">PDF</div>
                <div className="text-sm text-muted-foreground">Multipli</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <Users className="h-8 w-8 text-accent" />
                </div>
                <div className="text-2xl font-bold text-accent">Lead</div>
                <div className="text-sm text-muted-foreground">Estratti</div>
              </div>
              <div className="text-center">
                <div className="flex justify-center mb-2">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <div className="text-2xl font-bold text-primary">CRM</div>
                <div className="text-sm text-muted-foreground">Integrato</div>
              </div>
            </div>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-3xl blur-3xl transform rotate-6" />
            <img 
              src={heroImage} 
              alt="Il triturappalti - Elaborazione documenti" 
              className="relative z-10 w-full h-auto rounded-2xl shadow-elegant"
            />
          </div>
        </div>
      </div>
    </section>
  );
};