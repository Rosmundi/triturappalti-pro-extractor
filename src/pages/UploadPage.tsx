import { UploadSection } from "@/components/UploadSection";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, FileText } from "lucide-react";

interface UploadRow { id: string; filename: string; uploaded_at: string; status: string; }

export default function UploadPage() {
  const [recent, setRecent] = useState<UploadRow[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("uploads").select("id,filename,uploaded_at,status")
        .order("uploaded_at", { ascending: false }).limit(10);
      setRecent((data as UploadRow[]) || []);
    };
    load();
    const channel = supabase
      .channel("upload-page-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, load)
      .subscribe();
    const i = setInterval(load, 8000);
    return () => { supabase.removeChannel(channel); clearInterval(i); };
  }, []);

  return (
    <div className="p-6 grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <UploadSection onLeadsExtracted={() => {}} />
      </div>
      <Card className="h-fit lg:sticky lg:top-20">
        <CardHeader><CardTitle className="text-base">Elaborazioni recenti</CardTitle></CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun upload ancora.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((u) => (
                <li key={u.id} className="flex items-center gap-2 text-sm">
                  {u.status === "processing"
                    ? <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--processing))]" />
                    : u.status === "completed"
                      ? <CheckCircle className="h-3 w-3 text-[hsl(var(--success))]" />
                      : <FileText className="h-3 w-3 text-muted-foreground" />}
                  <span className="truncate flex-1" title={u.filename}>{u.filename}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(u.uploaded_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}