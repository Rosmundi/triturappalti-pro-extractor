import { Button } from "@/components/ui/button";
import { FileText, Settings, Download } from "lucide-react";

export const Header = () => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg shadow-elegant">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Il triturappalti
              </h1>
              <p className="text-sm text-muted-foreground">Estrazione automatica lead da appalti</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4" />
              Impostazioni
            </Button>
            <Button variant="professional" size="sm">
              <Download className="h-4 w-4" />
              Esporta
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
};