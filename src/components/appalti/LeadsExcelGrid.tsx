import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Copy, Rows3 } from "lucide-react";

export interface ExcelColumn<T> {
  key: keyof T & string;
  label: string;
  width?: number;
  editable?: boolean;
}

interface Props<T extends { id: string }> {
  rows: T[];
  columns: ExcelColumn<T>[];
  table?: string;
  onRowChange?: (id: string, patch: Partial<T>) => void;
  storageKey?: string;
}

const COL_LETTER = (i: number) => {
  let s = "";
  let n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

type Density = "compact" | "normal" | "comfortable";

export function LeadsExcelGrid<T extends { id: string }>({
  rows, columns, table = "leads", onRowChange, storageKey,
}: Props<T>) {
  const { toast } = useToast();
  const [density, setDensity] = useState<Density>(() => {
    const k = storageKey ? `${storageKey}.density` : "xls.density";
    return ((typeof window !== "undefined" && (localStorage.getItem(k) as Density)) || "normal") as Density;
  });
  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}.density`, density);
  }, [density, storageKey]);

  const [widths, setWidths] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    columns.forEach((c) => (base[c.key] = c.width ?? 140));
    if (!storageKey) return base;
    try {
      const raw = localStorage.getItem(`${storageKey}.widths`);
      if (raw) return { ...base, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return base;
  });
  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}.widths`, JSON.stringify(widths));
  }, [widths, storageKey]);

  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [editing, setEditing] = useState<{ r: number; c: number; value: string } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const cellValue = (row: T, key: string) => {
    const v = (row as any)[key];
    return v == null ? "" : String(v);
  };

  const startResize = (key: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    const startX = e.clientX;
    const startW = widths[key] ?? 140;
    const onMove = (ev: MouseEvent) => {
      const next = Math.max(60, startW + (ev.clientX - startX));
      setWidths((p) => ({ ...p, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const commitEdit = async () => {
    if (!editing) return;
    const col = columns[editing.c];
    const row = rows[editing.r];
    const original = cellValue(row, col.key);
    setEditing(null);
    if (editing.value === original) return;
    const patch: any = { [col.key]: editing.value || null };
    onRowChange?.(row.id, patch);
    const { error } = await supabase.from(table as any).update(patch).eq("id", row.id);
    if (error) {
      toast({ title: "Errore salvataggio", description: error.message, variant: "destructive" });
      onRowChange?.(row.id, { [col.key]: original } as any);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
      if (e.key === "Escape") { e.preventDefault(); setEditing(null); }
      return;
    }
    if (!sel) return;
    const { r, c } = sel;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel({ r: Math.min(rows.length - 1, r + 1), c }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel({ r: Math.max(0, r - 1), c }); }
    else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); setSel({ r, c: Math.min(columns.length - 1, c + 1) }); }
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); setSel({ r, c: Math.max(0, c - 1) }); }
    else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      const col = columns[c];
      if (col.editable !== false) setEditing({ r, c, value: cellValue(rows[r], col.key) });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const v = cellValue(rows[r], columns[c].key);
      navigator.clipboard.writeText(v).catch(() => undefined);
    }
  };

  const copyAllAsTSV = async () => {
    const header = columns.map((c) => c.label).join("\t");
    const body = rows.map((r) => columns.map((c) => cellValue(r, c.key).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t")).join("\n");
    await navigator.clipboard.writeText(header + "\n" + body);
    toast({ title: "Copiato", description: `${rows.length} righe copiate (incollabili in Excel).` });
  };

  const totalCount = useMemo(() => rows.length, [rows.length]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground">
          {totalCount} righe · doppio click per modificare · frecce / Enter per navigare
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={copyAllAsTSV}>
            <Copy className="h-3 w-3" /> Copia TSV
          </Button>
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Rows3 className="h-3 w-3 mx-1 text-muted-foreground" />
            {(["compact", "normal", "comfortable"] as Density[]).map((d) => (
              <button
                key={d}
                onClick={() => setDensity(d)}
                className={`px-2 py-0.5 text-[11px] rounded ${density === d ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {d === "compact" ? "Compatta" : d === "normal" ? "Normale" : "Comoda"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="xls-wrap focus:outline-none"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table className={`xls-grid density-${density}`}>
          <thead>
            <tr className="xls-col-letters">
              <th className="xls-row-num"> </th>
              {columns.map((_, i) => <th key={i}>{COL_LETTER(i)}</th>)}
            </tr>
            <tr>
              <th className="xls-row-num">#</th>
              {columns.map((col) => (
                <th key={col.key} style={{ width: widths[col.key], minWidth: widths[col.key] }} className="relative">
                  {col.label}
                  <span
                    onMouseDown={(e) => startResize(col.key, e)}
                    className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none"
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="text-center text-muted-foreground py-6">Nessun dato</td></tr>
            )}
            {rows.map((row, r) => (
              <tr key={row.id}>
                <td className="xls-row-num">{r + 1}</td>
                {columns.map((col, c) => {
                  const isSel = sel?.r === r && sel?.c === c;
                  const isEditing = editing?.r === r && editing?.c === c;
                  const v = cellValue(row, col.key);
                  return (
                    <td
                      key={col.key}
                      style={{ width: widths[col.key], minWidth: widths[col.key], maxWidth: widths[col.key] }}
                      className={`${isSel ? "xls-selected" : ""} ${isEditing ? "xls-editing" : ""}`}
                      onClick={() => setSel({ r, c })}
                      onDoubleClick={() => {
                        if (col.editable !== false) setEditing({ r, c, value: v });
                      }}
                      title={v}
                    >
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editing!.value}
                          onChange={(e) => setEditing({ ...editing!, value: e.target.value })}
                          onBlur={commitEdit}
                        />
                      ) : v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}