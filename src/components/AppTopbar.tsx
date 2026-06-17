import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Dashboard",
  "/carica": "Carica appalto",
  "/appalti-elaborati": "Appalti elaborati",
  "/lead": "Lead",
  "/esportazioni": "Esportazioni",
  "/impostazioni": "Impostazioni",
};

export function AppTopbar() {
  const { pathname } = useLocation();
  const label = ROUTE_LABELS[pathname] || "Triturappalti";
  const [processingCount, setProcessingCount] = useState<number>(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { count } = await supabase
        .from("uploads")
        .select("id", { count: "exact", head: true })
        .eq("status", "processing");
      if (mounted) setProcessingCount(count ?? 0);
    };
    load();
    const channel = supabase
      .channel("topbar-uploads")
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, load)
      .subscribe();
    const interval = setInterval(load, 10_000);
    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <SidebarTrigger />
      <div className="flex items-baseline gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Triturappalti</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-sm font-semibold">{label}</h1>
      </div>
      <div className="ml-auto flex items-center gap-2">
        {processingCount > 0 && (
          <Badge variant="secondary" className="gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            {processingCount} in elaborazione
          </Badge>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}