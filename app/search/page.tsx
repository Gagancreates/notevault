"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Alert, Badge, Empty, Highlight, PageHeader } from "@/components/ui";

type Mode = "hybrid" | "semantic" | "keyword";
type Hit = {
  chunk_id: string; document_id: string; title: string; folder: string;
  chunk_index: number; content: string; score: number; highlight: string;
};

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "hybrid", label: "Hybrid", hint: "70% meaning + 30% keywords" },
  { id: "semantic", label: "Semantic", hint: "pgvector cosine similarity" },
  { id: "keyword", label: "Keyword", hint: "PostgreSQL full-text search" },
];

export default function Search() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<Mode>("hybrid");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [ms, setMs] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [related, setRelated] = useState<Record<string, any[]>>({});

  const loadRecent = () => api("/api/search").then((d) => setRecent(d.recent)).catch(() => {});
  useEffect(() => { loadRecent(); }, []);

  async function search(text = q, m = mode) {
    if (!text.trim()) return;
    setBusy(true); setError(""); setRelated({});
    try {
      const d = await api("/api/search", { method: "POST", json: { query: text, mode: m } });
      setHits(d.results); setMs(d.ms);
      loadRecent();
    } catch (e: any) { setError(e.message); setHits(null); }
    setBusy(false);
  }

  async function showRelated(chunkId: string) {
    if (related[chunkId]) return setRelated(({ [chunkId]: _, ...rest }) => rest);
    const d = await api(`/api/documents/x/related?chunk=${chunkId}`);
    setRelated((r) => ({ ...r, [chunkId]: d.related }));
  }

  return (
    <div>
      <PageHeader title="Search your notes" sub="Ask in your own words. Results come from every ready document you own." />
      <form onSubmit={(e) => { e.preventDefault(); search(); }} className="card p-4">
        <div className="flex gap-2">
          <input autoFocus className="input text-base" placeholder="e.g. how do we remove redundant data from tables?" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn-primary shrink-0" disabled={busy}>{busy ? "Searching…" : "Search"}</button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Search mode">
          {MODES.map((m) => (
            <button
              type="button" key={m.id} role="radio" aria-checked={mode === m.id}
              onClick={() => { setMode(m.id); if (hits) search(q, m.id); }}
              className={`rounded-full border px-3 py-1 text-xs ${mode === m.id ? "border-accent bg-accent-soft text-accent" : "border-slate-300 text-slate-600 hover:bg-slate-50"}`}
            >
              <span className="font-medium">{m.label}</span> <span className="opacity-70">· {m.hint}</span>
            </button>
          ))}
        </div>
      </form>

      <div className="mt-4"><Alert>{error}</Alert></div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_260px]">
        <section>
          {hits === null ? (
            <div className="card"><Empty title="Search across all your notes">Try a concept rather than an exact phrase.</Empty></div>
          ) : hits.length === 0 ? (
            <div className="card"><Empty title="No matches">Try Semantic mode, or upload more notes.</Empty></div>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500">{hits.length} result{hits.length === 1 ? "" : "s"} · {ms} ms · <Badge tone={mode}>{mode}</Badge></p>
              <ol className="space-y-3">
                {hits.map((h, i) => (
                  <li key={h.chunk_id} className="card p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="tabular-nums text-slate-400">{i + 1}.</span>
                        <Link href={`/documents/${h.document_id}#chunk-${h.chunk_index}`} className="font-medium hover:text-accent">{h.title}</Link>
                        <span className="text-xs text-slate-400">· {h.folder} · chunk {h.chunk_index + 1}</span>
                      </div>
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs tabular-nums" title="Relevance score">
                        {Number(h.score).toFixed(3)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">
                      <Highlight text={h.highlight && h.highlight.includes("⟦") ? h.highlight : h.content.slice(0, 420) + (h.content.length > 420 ? "…" : "")} />
                    </p>
                    <button className="mt-2 text-xs text-accent hover:underline" onClick={() => showRelated(h.chunk_id)}>
                      {related[h.chunk_id] ? "Hide related notes" : "Related notes in other documents"}
                    </button>
                    {related[h.chunk_id] && (
                      <ul className="mt-2 space-y-2 border-l-2 border-accent-soft pl-3">
                        {related[h.chunk_id].length === 0 && <li className="text-xs text-slate-500">No other documents yet.</li>}
                        {related[h.chunk_id].map((r) => (
                          <li key={r.chunk_id} className="text-xs">
                            <Link href={`/documents/${r.document_id}#chunk-${r.chunk_index}`} className="font-medium hover:text-accent">{r.title}</Link>
                            <span className="ml-1 font-mono text-slate-400">{Number(r.score).toFixed(3)}</span>
                            <div className="text-slate-500">{r.preview}…</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>
        <aside className="card h-fit p-4">
          <div className="label">Recent searches</div>
          {recent.length === 0 ? <p className="text-sm text-slate-500">None yet.</p> : (
            <ul className="space-y-2 text-sm">
              {recent.map((r, i) => (
                <li key={i}>
                  <button className="text-left hover:text-accent" onClick={() => { setQ(r.query_text); setMode(r.mode); search(r.query_text, r.mode); }}>
                    {r.query_text}
                  </button>
                  <div className="text-xs text-slate-400">{r.mode} · {r.result_count} result{r.result_count === 1 ? "" : "s"} · {fmtDate(r.created_at)}</div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
