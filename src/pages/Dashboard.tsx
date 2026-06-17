import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FolderKanban, Users, Euro, Loader2, ArrowRight, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface UploadRow {
  id: string;
  filename: string;
  uploaded_at: string;
  status: string;
}
interface LeadRow {
  id: string;
  upload_id: string;
  value_eur: string | null;
  created_at: string;
}

export default function Dashboard() {
  const [uploads, setUploads] = useState<UploadRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [u, l] = await Promise.all([
      supabase.from("uploads").select("id,filename,uploaded_at,status").order("uploaded_at", { ascending: false }),
      supabase.from("leads").select("id,upload_id,value_eur,created_at"),
    ]);
    setUploads((u.data as UploadRow[]) || []);
    setLeads((l.data as LeadRow[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, []);

  const processingCount = uploads.filter((u) => u.status === "processing").length;
  const totalValue = leads.reduce((sum, l) => {
    const n = parseFloat((l.value_eur || "0").replace(/[^\d.-]/g, ""));
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  // Build last 6 months chart
  const months: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("it-IT", { month: "short" }),
    });
  }
  const chartData = months.map((m) => {
    const appalti = uploads.filter((u) => u.uploaded_at?.startsWith(m.key)).length;
    const lead = leads.filter((l) => l.created_at?.startsWith(m.key)).length;
    return { mese: m.label, appalti, lead };
  });

  const recentUploads = uploads.slice(0, 5);
  const processing = uploads.filter((u) => u.status === "processing").slice(0, 5);

  const kpis = [
    { label: "Appalti totali", value: uploads.length, icon: FolderKanban, tone: "text-primary" },
    { label: "In elaborazione", value: processingCount, icon: Loader2, tone: "text-[hsl(var(--processing))]" },
    { label: "Lead estratti", value: leads.length, icon: Users, tone: "text-[hsl(var(--info))]" },
    {
      label: "Valore stimato",
      value: totalValue ? `€${Math.round(totalValue).toLocaleString("it-IT")}` : "—",
      icon: Euro,
      tone: "text-[hsl(var(--success))]",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Panoramica</h2>
          <p className="text-sm text-muted-foreground">Monitora elaborazioni, lead e attività recenti.</p>
        </div>
        <Link to="/carica">
          <Button>
            <Upload className="h-4 w-4" /> Carica nuovo PDF
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className="text-2xl font-bold mt-1">{loading ? "…" : k.value}</div>
              </div>
              <k.icon className={`h-8 w-8 ${k.tone}`} />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Attività ultimi 6 mesi</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mese" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="appalti" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lead" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">In elaborazione</CardTitle></CardHeader>
          <CardContent>
            {processing.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessuna elaborazione in corso.</p>
            ) : (
              <ul className="space-y-2">
                {processing.map((u) => (
                  <li key={u.id} className="flex items-center gap-2 text-sm">
                    <Loader2 className="h-3 w-3 animate-spin text-[hsl(var(--processing))]" />
                    <span className="truncate flex-1" title={u.filename}>{u.filename}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ultimi appalti elaborati</CardTitle>
          <Link to="/appalti-elaborati"><Button variant="ghost" size="sm">Vedi tutti <ArrowRight className="h-3 w-3" /></Button></Link>
        </CardHeader>
        <CardContent>
          {recentUploads.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun appalto ancora.</p>
          ) : (
            <ul className="divide-y">
              {recentUploads.map((u) => {
                const leadCount = leads.filter((l) => l.upload_id === u.id).length;
                return (
                  <li key={u.id} className="py-2 flex items-center gap-3 text-sm">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 truncate font-medium" title={u.filename}>{u.filename}</span>
                    <Badge variant={u.status === "processing" ? "secondary" : "outline"}>{u.status}</Badge>
                    <span className="text-xs text-muted-foreground w-16 text-right">{leadCount} lead</span>
                    <span className="text-xs text-muted-foreground w-28 text-right">
                      {new Date(u.uploaded_at).toLocaleDateString("it-IT")}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}