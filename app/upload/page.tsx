"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client";
import { Alert, Badge, PageHeader } from "@/components/ui";

type Result = { name: string; ok: boolean; message: string; id?: string; chunks?: number; status?: string };

export default function Upload() {
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [folderId, setFolderId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => { api("/api/folders").then((d) => setFolders(d.folders)).catch((e) => setError(e.message)); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return setError("Choose at least one file");
    setBusy(true); setError(""); setResults([]);
    for (const f of files) {
      const fd = new FormData();
      fd.append("file", f);
      if (folderId) fd.append("folderId", folderId);
      try {
        const r = await api("/api/documents", { method: "POST", body: fd });
        setResults((x) => [...x, { name: f.name, ok: true, message: "Embedded", id: r.document.id, chunks: r.document.chunk_count, status: r.document.status }]);
      } catch (err: any) {
        setResults((x) => [...x, { name: f.name, ok: false, message: err.message }]);
      }
    }
    setBusy(false); setFiles([]);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Upload notes" sub="PDF, .txt or .md, up to 10 MB each. Each file is split into chunks and embedded in one transaction." />
      <form onSubmit={submit} className="card space-y-5 p-6">
        <label
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-accent hover:bg-accent-soft/40"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setFiles(Array.from(e.dataTransfer.files)); }}
        >
          <span className="text-sm font-medium">Drop files here or click to choose</span>
          <span className="mt-1 text-xs text-slate-500">.pdf · .txt · .md</span>
          <input ref={input} type="file" multiple accept=".pdf,.txt,.md" className="sr-only"
            onChange={(e) => setFiles(Array.from(e.target.files || []))} />
        </label>
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f) => <li key={f.name} className="flex justify-between"><span>{f.name}</span><span className="text-slate-400">{(f.size / 1024).toFixed(0)} KB</span></li>)}
          </ul>
        )}
        <div>
          <label className="label" htmlFor="folder">Folder</label>
          <select id="folder" className="input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Unfiled</option>
            {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <Alert>{error}</Alert>
        <button className="btn-primary" disabled={busy || !files.length}>
          {busy ? "Parsing, chunking and embedding…" : `Upload ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
        </button>
      </form>

      {results.length > 0 && (
        <div className="card mt-6 divide-y divide-slate-100">
          {results.map((r) => (
            <div key={r.name} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className={r.ok ? "text-slate-500" : "text-red-600"}>
                  {r.ok ? `${r.chunks} chunk${r.chunks === 1 ? "" : "s"} embedded` : r.message}
                </div>
              </div>
              {r.ok ? (
                <div className="flex items-center gap-3">
                  <Badge tone={r.status}>{r.status}</Badge>
                  <Link href={`/documents/${r.id}`} className="text-accent hover:underline">View</Link>
                </div>
              ) : <Badge tone="pending">failed</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
