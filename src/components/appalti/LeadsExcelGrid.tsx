import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Copy, Rows3, Eye, EyeOff } from "lucide-react";

export interface ExcelColumn<T> {
  key: keyof T & string;
  label: string;
  width?: number;
  editable?: boolean;
  group?: string;
}

interface Props<T extends { id: string }> {
  rows: T[];
  columns: ExcelColumn<T>[];
  table?: string;
  onRowChange?: (id: string, patch: Partial<T>) => void;
  storageKey?: string;
  groupLabels?: Record<string, string>;
  groupClassName?: (group?: string) => string;
}

const COL_LETTER = (i: number) => {
  let s = "";
  let n = i;
  while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
  return s;
};

type Density = "compact" | "normal" | "comfortable";

export function LeadsExcelGrid<T extends { id: string }>({
  rows, columns, table = "leads", onRowChange, storageKey, groupLabels, groupClassName,
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

  // Hidden columns / rows (persisted)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (!storageKey) return new Set();
    try {
      const raw = localStorage.getItem(`${storageKey}.hiddenCols`);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}.hiddenCols`, JSON.stringify(Array.from(hiddenCols)));
  }, [hiddenCols, storageKey]);

  const [hiddenRows, setHiddenRows] = useState<Set<string>>(() => {
    if (!storageKey) return new Set();
    try {
      const raw = localStorage.getItem(`${storageKey}.hiddenRows`);
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  useEffect(() => {
    if (storageKey) localStorage.setItem(`${storageKey}.hiddenRows`, JSON.stringify(Array.from(hiddenRows)));
  }, [hiddenRows, storageKey]);

  const [menu, setMenu] = useState<
    | { x: number; y: number; type: "col"; colKey: string }
    | { x: number; y: number; type: "row"; rowId: string }
    | null
  >(null);
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => { window.removeEventListener("click", close); window.removeEventListener("scroll", close, true); };
  }, [menu]);

  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.has(c.key)), [columns, hiddenCols]);
  const visibleRows = useMemo(() => rows.filter((r) => !hiddenRows.has(r.id)), [rows, hiddenRows]);

  // Build contiguous group spans from visibleColumns
  const groupSpans = useMemo(() => {
    const spans: { group?: string; span: number; startIndex: number }[] = [];
    visibleColumns.forEach((c, i) => {
      const last = spans[spans.length - 1];
      if (last && last.group === c.group) last.span += 1;
      else spans.push({ group: c.group, span: 1, startIndex: i });
    });
    return spans;
  }, [visibleColumns]);

  const groupClassFor = (g?: string) => {
    if (groupClassName) return groupClassName(g) || "";
    if (!g) return "";
    return `xls-group-${g}`;
  };
  const isGroupStart = (i: number) =>
    i > 0 && visibleColumns[i].group !== visibleColumns[i - 1].group;

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
    const col = visibleColumns[editing.c];
    const row = visibleRows[editing.r];
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
    if (e.key === "ArrowDown") { e.preventDefault(); setSel({ r: Math.min(visibleRows.length - 1, r + 1), c }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel({ r: Math.max(0, r - 1), c }); }
    else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); setSel({ r, c: Math.min(visibleColumns.length - 1, c + 1) }); }
    else if (e.key === "ArrowLeft" || (e.key === "Tab" && e.shiftKey)) { e.preventDefault(); setSel({ r, c: Math.max(0, c - 1) }); }
    else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      const col = visibleColumns[c];
      if (col.editable !== false) setEditing({ r, c, value: cellValue(visibleRows[r], col.key) });
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
      const v = cellValue(visibleRows[r], visibleColumns[c].key);
      navigator.clipboard.writeText(v).catch(() => undefined);
    }
  };

  const copyAllAsTSV = async () => {
    const header = visibleColumns.map((c) => c.label).join("\t");
    const body = visibleRows.map((r) => visibleColumns.map((c) => cellValue(r, c.key).replace(/\t/g, " ").replace(/\n/g, " ")).join("\t")).join("\n");
    await navigator.clipboard.writeText(header + "\n" + body);
    toast({ title: "Copiato", description: `${visibleRows.length} righe copiate (incollabili in Excel).` });
  };

  const showAllCols = () => setHiddenCols(new Set());
  const showAllRows = () => setHiddenRows(new Set());

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-muted-foreground">
          {visibleRows.length}/{rows.length} righe · {visibleColumns.length}/{columns.length} colonne · doppio click per modificare · click destro per nascondere
        </div>
        <div className="ml-auto flex items-center gap-2">
          {hiddenCols.size > 0 && (
            <Button size="sm" variant="outline" onClick={showAllCols}>
              <Eye className="h-3 w-3" /> Mostra colonne ({hiddenCols.size})
            </Button>
          )}
          {hiddenRows.size > 0 && (
            <Button size="sm" variant="outline" onClick={showAllRows}>
              <Eye className="h-3 w-3" /> Mostra righe ({hiddenRows.size})
            </Button>
          )}
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
            {groupSpans.some((s) => s.group) && (
              <tr className="xls-group-row">
                <th className="xls-row-num"> </th>
                {groupSpans.map((s, i) => (
                  <th
                    key={i}
                    colSpan={s.span}
                    className={`${groupClassFor(s.group)} ${s.startIndex > 0 ? "xls-group-start" : ""}`}
                  >
                    {s.group ? (groupLabels?.[s.group] ?? s.group) : ""}
                  </th>
                ))}
              </tr>
            )}
            <tr className="xls-col-letters">
              <th className="xls-row-num"> </th>
              {visibleColumns.map((col, i) => (
                <th
                  key={i}
                  className={`${groupClassFor(col.group)} ${isGroupStart(i) ? "xls-group-start" : ""}`}
                >{COL_LETTER(i)}</th>
              ))}
            </tr>
            <tr>
              <th className="xls-row-num">#</th>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{ width: widths[col.key], minWidth: widths[col.key] }}
                  className={`relative ${groupClassFor(col.group)} ${isGroupStart(visibleColumns.indexOf(col)) ? "xls-group-start" : ""}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setMenu({ x: e.clientX, y: e.clientY, type: "col", colKey: col.key });
                  }}
                >
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
            {visibleRows.length === 0 && (
              <tr><td colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground py-6">Nessun dato</td></tr>
            )}
            {visibleRows.map((row, r) => (
              <tr key={row.id} onContextMenu={(e) => {
                // only trigger row menu if event target is the row-num cell handler below;
                // here we let cell handler override
              }}>
                <td
                  className="xls-row-num"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenu({ x: e.clientX, y: e.clientY, type: "row", rowId: row.id });
                  }}
                >{r + 1}</td>
                {visibleColumns.map((col, c) => {
                  const isSel = sel?.r === r && sel?.c === c;
                  const isEditing = editing?.r === r && editing?.c === c;
                  const v = cellValue(row, col.key);
                  return (
                    <td
                      key={col.key}
                      style={{ width: widths[col.key], minWidth: widths[col.key], maxWidth: widths[col.key] }}
                      className={`${groupClassFor(col.group)} ${isGroupStart(c) ? "xls-group-start" : ""} ${isSel ? "xls-selected" : ""} ${isEditing ? "xls-editing" : ""}`}
                      onClick={() => setSel({ r, c })}
                      onDoubleClick={() => {
                        if (col.editable !== false) setEditing({ r, c, value: v });
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setMenu({ x: e.clientX, y: e.clientY, type: "row", rowId: row.id });
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

      {menu && (
        <div
          className="fixed z-50 min-w-[200px] rounded-md border bg-popover text-popover-foreground shadow-md py-1 text-sm"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.type === "col" ? (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                onClick={() => {
                  setHiddenCols((p) => { const n = new Set(p); n.add(menu.colKey); return n; });
                  setMenu(null);
                }}
              >
                <EyeOff className="h-3.5 w-3.5" /> Nascondi colonna
              </button>
              {hiddenCols.size > 0 && (
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                  onClick={() => { showAllCols(); setMenu(null); }}
                >
                  <Eye className="h-3.5 w-3.5" /> Mostra tutte le colonne ({hiddenCols.size})
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                onClick={() => {
                  setHiddenRows((p) => { const n = new Set(p); n.add(menu.rowId); return n; });
                  setMenu(null);
                }}
              >
                <EyeOff className="h-3.5 w-3.5" /> Nascondi riga
              </button>
              {hiddenRows.size > 0 && (
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 hover:bg-muted"
                  onClick={() => { showAllRows(); setMenu(null); }}
                >
                  <Eye className="h-3.5 w-3.5" /> Mostra tutte le righe ({hiddenRows.size})
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}