import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";

export default function Exports() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Centro esportazioni</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Per ora puoi esportare ogni appalto in Excel dalla pagina <strong>Appalti elaborati</strong> con il pulsante verde a fianco di ogni file.</p>
          <p>Nella prossima fase: export multi-foglio (Appalti + Lead + Combinato), CSV, invio CRM bulk e <strong>storico invii</strong>.</p>
        </CardContent>
      </Card>
    </div>
  );
}