import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Settings() {
  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader><CardTitle>Aspetto</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Tema</div>
            <div className="text-xs text-muted-foreground">Passa da chiaro a scuro.</div>
          </div>
          <ThemeToggle />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Preferenze tabella</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Le preferenze di colonne, larghezze e densità della griglia Excel vengono salvate automaticamente nel tuo browser.
        </CardContent>
      </Card>
    </div>
  );
}