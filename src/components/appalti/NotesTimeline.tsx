import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Clock, Save, Loader2 } from "lucide-react";

interface Props {
  raw: string | null;
  draft: string;
  onDraftChange: (v: string) => void;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  placeholder?: string;
  title?: string;
}

interface Entry { date: string | null; text: string; }

function parseNotes(raw: string | null | undefined): Entry[] {
  if (!raw) return [];
  // Match optional [DD/MM/YYYY HH:MM] header at start of an entry, separated by blank lines
  const re = /\[(\d{2}\/\d{2}\/\d{4} \d{2}:\d{2})\]\s*([\s\S]*?)(?=\n\n\[\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\]|\s*$)/g;
  const entries: Entry[] = [];
  let m: RegExpExecArray | null;
  let consumed = 0;
  while ((m = re.exec(raw))) {
    if (m.index > consumed) {
      const prefix = raw.slice(consumed, m.index).trim();
      if (prefix) entries.push({ date: null, text: prefix });
    }
    entries.push({ date: m[1], text: m[2].trim() });
    consumed = re.lastIndex;
  }
  if (consumed < raw.length) {
    const rest = raw.slice(consumed).trim();
    if (rest) entries.push({ date: null, text: rest });
  }
  if (entries.length === 0 && raw.trim()) entries.push({ date: null, text: raw.trim() });
  // Most recent first
  return entries.reverse();
}

export function NotesTimeline({ raw, draft, onDraftChange, onSave, saving, placeholder, title }: Props) {
  const entries = parseNotes(raw);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="space-y-3">
      {title && <div className="text-sm font-semibold">{title}</div>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={placeholder || "Scrivi una nuova nota… verrà aggiunta con data e ora."}
            className="min-h-[110px] text-sm"
          />
          <Button size="sm" onClick={onSave} disabled={saving || !draft.trim()}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salva nota datata
          </Button>
        </div>
        <div className="rounded-md border bg-muted/30 p-3 max-h-[260px] overflow-auto">
          {entries.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Nessuna nota.</p>
          ) : (
            <ol className="space-y-3">
              {(collapsed ? entries.slice(0, 3) : entries).map((e, i) => (
                <li key={i} className="text-sm border-l-2 border-primary/50 pl-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {e.date || "data non registrata"}
                  </div>
                  <div className="whitespace-pre-wrap mt-0.5">{e.text}</div>
                </li>
              ))}
            </ol>
          )}
          {entries.length > 3 && (
            <button
              type="button"
              className="text-[11px] text-primary hover:underline mt-2"
              onClick={() => setCollapsed((v) => !v)}
            >
              {collapsed ? `Mostra tutte (${entries.length})` : "Mostra meno"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}