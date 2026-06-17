import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

export default function LeadsAll() {
  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Lead (vista trasversale)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            In arrivo nella prossima fase: vista Excel di tutti i lead di tutti gli appalti, con filtri per categoria, qualità, città e provincia.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}