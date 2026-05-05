import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Play, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryExecutionResult, queryApi } from '@/lib/api';
import { useCreateScript, useDeleteScript, useScripts, useUpdateScript } from '@/hooks/useScripts';
import { useAppStore } from '@/store';

// ── Query result display ──────────────────────────────────────────────────────

function QueryResultView({ result }: { result: QueryExecutionResult }) {
  if (result.type === 'select') {
    const cols = result.fields.map((f) => f.name);
    return (
      <div className="overflow-auto h-full">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-muted z-10">
            <tr className="border-b">
              {cols.map((c) => (
                <th key={c} className="text-left px-3 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length} className="px-3 py-4 text-center text-muted-foreground">
                  No rows returned
                </td>
              </tr>
            ) : (
              result.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-1 font-mono whitespace-nowrap max-w-[300px] overflow-hidden text-ellipsis">
                      {row[c] === null || row[c] === undefined ? (
                        <span className="text-muted-foreground/40 italic">null</span>
                      ) : (
                        String(row[c])
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
        <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-t">
          {result.row_count} row{result.row_count !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  if (result.type === 'mutation') {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-green-700 dark:text-green-400">
        <span className="font-medium">{result.command}</span>
        <span className="text-muted-foreground">·</span>
        <span>{result.affected_rows} row{result.affected_rows !== 1 ? 's' : ''} affected</span>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 text-sm text-green-700 dark:text-green-400 font-medium">
      {result.command}
    </div>
  );
}

// ── Script editor ─────────────────────────────────────────────────────────────

const RESULTS_MIN_H = 60;
const RESULTS_MAX_H = 800;
const RESULTS_DEFAULT_H = 220;

function ScriptEditor({
  connectionId,
  name,
  content,
  isDirty,
  isSaving,
  isDeleting,
  onNameChange,
  onContentChange,
  onSave,
  onDelete,
}: {
  connectionId: number;
  name: string;
  content: string;
  isDirty: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onNameChange: (name: string) => void;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const backendInfo = useAppStore((s) => s.backendInfo);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execResult, setExecResult] = useState<QueryExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [resultsHeight, setResultsHeight] = useState(RESULTS_DEFAULT_H);
  const dragRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const hasResults = execResult !== null || execError !== null;

  async function handleExecute() {
    if (!backendInfo || !content.trim()) return;
    setIsExecuting(true);
    setExecResult(null);
    setExecError(null);
    try {
      const result = await queryApi.execute(connectionId, content, backendInfo);
      setExecResult(result);
    } catch (err) {
      setExecError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setIsExecuting(false);
    }
  }

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startHeight: resultsHeight };

    function onMove(ev: MouseEvent) {
      if (!dragRef.current) return;
      const delta = dragRef.current.startY - ev.clientY; // drag up → bigger results
      setResultsHeight(
        Math.max(RESULTS_MIN_H, Math.min(RESULTS_MAX_H, dragRef.current.startHeight + delta)),
      );
    }

    function onUp() {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b flex items-center gap-2">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="flex-1 min-w-0 text-sm font-medium bg-transparent border-0 outline-none focus:ring-1 focus:ring-ring rounded px-1 -ml-1"
          placeholder="Script name"
        />
        <Button
          size="sm"
          variant="default"
          onClick={handleExecute}
          disabled={isExecuting || !content.trim()}
          className="h-7 gap-1.5 text-xs"
        >
          {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onSave}
          disabled={isSaving || !isDirty}
          className="h-7 gap-1.5 text-xs"
        >
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          disabled={isDeleting}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
        >
          {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Editor + results */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* Textarea — flex-1 so it takes remaining space above results */}
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          spellCheck={false}
          placeholder="Write SQL here…"
          className="flex-1 min-h-0 w-full resize-none p-4 font-mono text-sm bg-transparent border-0 outline-none focus:outline-none placeholder:text-muted-foreground/40"
        />

        {/* Drag handle + resizable results pane */}
        {hasResults && (
          <>
            {/* Drag handle */}
            <div
              onMouseDown={onDragStart}
              className="shrink-0 h-2 border-t border-b cursor-row-resize select-none flex items-center justify-center group bg-muted/30 hover:bg-muted/60 transition-colors"
            >
              <div className="w-10 h-0.5 rounded-full bg-border group-hover:bg-muted-foreground/40 transition-colors" />
            </div>

            {/* Results pane — fixed height, user-resizable */}
            <div
              style={{ height: resultsHeight }}
              className="shrink-0 overflow-auto flex flex-col"
            >
              {execError && (
                <div className="flex items-start gap-2 px-4 py-3 text-sm text-destructive bg-destructive/5 h-full overflow-auto">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <pre className="whitespace-pre-wrap font-mono text-xs">{execError}</pre>
                </div>
              )}
              {execResult && <QueryResultView result={execResult} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Scripts panel ─────────────────────────────────────────────────────────────

interface DraftScript {
  draftId: string;
  name: string;
  content: string;
}

type TabEntry =
  | { kind: 'saved'; id: string; scriptId: number; name: string; content: string }
  | { kind: 'draft'; id: string; name: string; content: string };

let draftCounter = 0;
function newDraftId() { return `draft-${++draftCounter}`; }

export function ScriptsPanel({ connectionId }: { connectionId: number }) {
  const { data: scripts = [], isLoading } = useScripts(connectionId);
  const createScript = useCreateScript(connectionId);
  const updateScript = useUpdateScript(connectionId);
  const deleteScript = useDeleteScript(connectionId);

  // Local state for dirty edits on saved scripts
  const [localEdits, setLocalEdits] = useState<Record<number, { name: string; content: string }>>({});
  // Unsaved draft scripts (not yet in the DB)
  const [drafts, setDrafts] = useState<DraftScript[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const initialized = useRef(false);

  // On first load: if no scripts exist, create an initial draft
  useEffect(() => {
    if (isLoading || initialized.current) return;
    initialized.current = true;
    if (scripts.length === 0) {
      const id = newDraftId();
      setDrafts([{ draftId: id, name: 'Script 1', content: '' }]);
      setActiveTab(id);
    } else {
      setActiveTab(String(scripts[0].id));
    }
  }, [isLoading, scripts]);

  // Build merged tab list
  const allTabs: TabEntry[] = [
    ...scripts.map((s) => ({
      kind: 'saved' as const,
      id: String(s.id),
      scriptId: s.id,
      name: localEdits[s.id]?.name ?? s.name,
      content: localEdits[s.id]?.content ?? s.content,
    })),
    ...drafts.map((d) => ({
      kind: 'draft' as const,
      id: d.draftId,
      name: d.name,
      content: d.content,
    })),
  ];

  // Keep active tab valid after scripts change
  useEffect(() => {
    if (allTabs.length === 0) return;
    if (!allTabs.find((t) => t.id === activeTab)) {
      setActiveTab(allTabs[0].id);
    }
  }, [allTabs, activeTab]);

  function addScript() {
    const id = newDraftId();
    const name = `Script ${allTabs.length + 1}`;
    setDrafts((prev) => [...prev, { draftId: id, name, content: '' }]);
    setActiveTab(id);
  }

  function updateTabContent(tab: TabEntry, field: 'name' | 'content', value: string) {
    if (tab.kind === 'saved') {
      const base = scripts.find((s) => s.id === tab.scriptId)!;
      setLocalEdits((prev) => ({
        ...prev,
        [tab.scriptId]: {
          name: field === 'name' ? value : (prev[tab.scriptId]?.name ?? base.name),
          content: field === 'content' ? value : (prev[tab.scriptId]?.content ?? base.content),
        },
      }));
    } else {
      setDrafts((prev) =>
        prev.map((d) => d.draftId === tab.id ? { ...d, [field]: value } : d),
      );
    }
  }

  async function handleSave(tab: TabEntry) {
    if (tab.kind === 'draft') {
      const created = await createScript.mutateAsync({ name: tab.name, content: tab.content });
      setDrafts((prev) => prev.filter((d) => d.draftId !== tab.id));
      setActiveTab(String(created.id));
    } else {
      await updateScript.mutateAsync({ id: tab.scriptId, input: { name: tab.name, content: tab.content } });
      setLocalEdits((prev) => { const n = { ...prev }; delete n[tab.scriptId]; return n; });
    }
  }

  async function handleDelete(tab: TabEntry) {
    if (!confirm(`Delete "${tab.name}"?`)) return;

    // Find the next tab to activate before removing this one
    const idx = allTabs.findIndex((t) => t.id === tab.id);
    const next = allTabs[idx + 1] ?? allTabs[idx - 1];

    if (tab.kind === 'draft') {
      setDrafts((prev) => prev.filter((d) => d.draftId !== tab.id));
    } else {
      await deleteScript.mutateAsync(tab.scriptId);
      setLocalEdits((prev) => { const n = { ...prev }; delete n[tab.scriptId]; return n; });
    }

    if (next) {
      setActiveTab(next.id);
    } else {
      // No tabs left — create a fresh draft
      const id = newDraftId();
      setDrafts([{ draftId: id, name: 'Script 1', content: '' }]);
      setActiveTab(id);
    }
  }

  function isDirty(tab: TabEntry): boolean {
    if (tab.kind === 'draft') return true;
    const edit = localEdits[tab.scriptId];
    if (!edit) return false;
    const base = scripts.find((s) => s.id === tab.scriptId);
    return !!base && (edit.name !== base.name || edit.content !== base.content);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading scripts…</span>
      </div>
    );
  }

  if (allTabs.length === 0) return null;

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="flex flex-col h-full gap-0"
    >
      {/* Tab strip */}
      <div className="shrink-0 border-b flex items-end gap-0 overflow-x-auto">
        <TabsList
          variant="line"
          className="h-auto -mb-px gap-0 rounded-none bg-transparent p-0 shrink-0 flex-nowrap"
        >
          {allTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="rounded-none px-4 pb-2.5 pt-2 text-xs relative shrink-0"
            >
              {tab.name}
              {isDirty(tab) && (
                <span className="absolute top-1.5 right-1 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <button
          onClick={addScript}
          className="shrink-0 mb-px px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
          title="Add script"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tab contents */}
      {allTabs.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="flex-1 min-h-0 overflow-hidden mt-0">
          <ScriptEditor
            connectionId={connectionId}
            name={tab.name}
            content={tab.content}
            isDirty={isDirty(tab)}
            isSaving={createScript.isPending || updateScript.isPending}
            isDeleting={deleteScript.isPending}
            onNameChange={(v) => updateTabContent(tab, 'name', v)}
            onContentChange={(v) => updateTabContent(tab, 'content', v)}
            onSave={() => handleSave(tab)}
            onDelete={() => handleDelete(tab)}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}
