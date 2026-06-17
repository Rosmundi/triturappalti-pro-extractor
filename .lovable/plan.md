# Revisione UI/UX — Fase 1 + Fase 2 (con vista "Excel-like" e dark mode)

Manteniamo intatte: edge functions, webhook n8n, logica note datate, RLS, schema DB esistente. Nessuna modifica al backend in queste fasi (lo storico invii CRM arriverà in Fase 4).

---

## Fase 1 — App shell, navigazione, dashboard, dark mode

### 1.1 Layout applicazione
- Nuovo `src/layouts/AppLayout.tsx` con `SidebarProvider` shadcn + `Outlet`
- Nuovo `src/components/AppSidebar.tsx` (collapsible icon mode):
  - Dashboard · Carica appalto · Appalti elaborati · Lead · Esportazioni · Impostazioni
  - Stato attivo via `NavLink`
- Nuova `src/components/AppTopbar.tsx`: `SidebarTrigger`, breadcrumb, ricerca globale (placeholder), toggle tema, badge "elaborazioni in corso"

### 1.2 Routing
`src/App.tsx` rivisto con route nidificate:
```
/                    → Dashboard
/carica              → UploadPage (riusa UploadSection esistente)
/appalti-elaborati   → ProcessedTenders (Fase 2 redesign)
/lead                → LeadsAll (placeholder Fase 3)
/esportazioni        → Exports (placeholder Fase 4)
/impostazioni        → Settings (tema, densità, colonne default)
```

### 1.3 Dark mode
- Provider tema con `next-themes` (o implementazione custom su `class` html)
- Token dark estesi in `src/index.css` (rivedere variabili `--background`, `--foreground`, `--brand-*`, stati `success/warning/info/processing`)
- Toggle in topbar; persistenza in `localStorage`
- Tutti i componenti usano già token semantici → verifica e fix dove ci sono colori hardcoded

### 1.4 Dashboard `src/pages/Dashboard.tsx`
- 4 cards KPI: appalti totali, in elaborazione, lead totali, valore € aggregato
- Grafico Recharts: appalti/lead per mese (ultimi 6)
- Tabella "Ultimi 5 appalti elaborati" con link a dettaglio
- Tabella "In elaborazione" con polling 10s
- Quick action "Carica nuovo PDF"

### 1.5 Pagina Carica `src/pages/UploadPage.tsx`
- Wrapper su `UploadSection` con sidebar laterale "Elaborazioni recenti" (status live)

---

## Fase 2 — Redesign "Appalti elaborati" + vista Excel-like

### 2.1 Refactor del monolite `ProcessedTenders.tsx` (1109 righe)
Spezzato in:
```
pages/ProcessedTenders.tsx        (orchestrazione, ~200 righe)
components/appalti/AppaltiMasterList.tsx    (lista sinistra)
components/appalti/AppaltoDetailPanel.tsx   (pannello destro con tabs)
components/appalti/LeadsTable.tsx           (tabella lead)
components/appalti/LeadsExcelGrid.tsx       (vista Excel-like)
components/appalti/NotesTimeline.tsx        (note datate come timeline)
components/appalti/AppaltiFilters.tsx       (toolbar filtri)
components/appalti/ExportMenu.tsx           (XLSX/CSV)
hooks/useAppalti.ts                         (fetch + filtri via react-query)
hooks/useColumnPrefs.ts                     (persistenza colonne/densità)
```

### 2.2 Layout master-detail
- Sinistra (380px, resizable): lista file/appalti, ricerca, badge stato/valore/qualità, raggruppata per file
- Destra: header appalto + tabs `Panoramica` · `Lead` · `Note` · `CRM`
- Risolve l'attuale problema dei 3 livelli di accordion annidati

### 2.3 Vista "Excel-like" per Lead e Appalti (richiesta esplicita)
Toggle nella toolbar: **Tabella compatta** ↔ **Foglio Excel** ↔ **Cards**

`LeadsExcelGrid` con [TanStack Table](https://tanstack.com/table) + look&feel Excel:
- Griglia a celle con bordi sottili, header grigio sticky, prima colonna con numeri di riga
- Lettere colonna (A, B, C…) opzionali nell'header
- Celle **editabili inline** (doppio click → input), salvataggio su blur con update Supabase
- Navigazione tastiera: frecce, Tab/Shift+Tab, Enter, Esc
- Selezione multipla celle/righe, copia (Ctrl+C) come TSV → incollabile in Excel reale
- Resize colonne (già parziale oggi) + riordino drag&drop + nascondi/mostra
- Sort multi-colonna, filtri per colonna in stile Excel (menu nell'header)
- Freeze prime N colonne (Azienda/Referente)
- Zebra rows, densità compatta/normale/comoda
- Footer riga con conteggi (N righe, somma valore €)
- Stessa griglia riutilizzata per la futura pagina `/lead` e per la tabella appalti nella Dashboard

Resta disponibile la vista "Tabella" attuale (più moderna, badge colorati) per chi non vuole Excel.

### 2.4 Note datate → Timeline
- Le note esistenti (concatenate con `[DD/MM/YYYY HH:MM]`) vengono **parsate e mostrate come timeline** (card cronologiche, più recente in cima)
- Input nuova nota separato, salvataggio mantiene il formato attuale (compatibile)
- Funziona sia per `note` (lead) sia per `note_appalto`

### 2.5 Toolbar filtri
Ricerca testo · categoria · qualità · città/provincia · fascia valore · stato CRM · data elaborazione · solo "miei preferiti" (flag locale)

### 2.6 Azioni bulk
Checkbox riga → barra azioni: elimina, esporta selezione (XLSX/CSV), invia a CRM, copia negli appunti

### 2.7 Export migliorato
`ExportMenu`: XLSX multi-sheet (Appalti, Lead, Combinato), CSV, copia TSV. Usa `xlsx` già in deps.

### 2.8 Persistenza preferenze (localStorage)
Vista preferita (tabella/excel/cards), colonne visibili, larghezze, densità, tema, ordine colonne.

---

## Cosa NON cambia in queste fasi
- Schema DB e RLS (nessuna migrazione)
- Edge functions `process-pdf` e `receive-n8n-results`
- Logica salvataggio note datate
- Webhook n8n e payload CRM Zoho

## Cosa arriverà dopo
- **Fase 3**: pagina `/lead` trasversale con stessa griglia Excel
- **Fase 4**: Centro Esportazioni + **tabella `crm_submissions` per storico invii** (migrazione DB)
- **Fase 5**: polish animazioni, empty states, skeleton

---

Pronto a partire con Fase 1 (shell + dashboard + dark) e a seguire Fase 2 (master-detail + griglia Excel + timeline note).