import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export const Header = () => {
  const location = useLocation();
  
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg shadow-elegant">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Il triturappalti
              </h1>
              <p className="text-sm text-muted-foreground">Estrazione automatica lead da appalti</p>
            </div>
          </Link>
          
          <nav className="flex items-center space-x-2">
            <Link to="/">
              <Button 
                variant={location.pathname === "/" ? "default" : "ghost"}
                size="sm"
              >
                Carica PDF
              </Button>
            </Link>
            <Link to="/appalti-elaborati">
              <Button 
                variant={location.pathname === "/appalti-elaborati" ? "default" : "ghost"}
                size="sm"
              >
                Appalti elaborati
              </Button>
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};