"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, fmtDate } from "@/lib/client";
import { Alert, Badge, Empty, PageHeader, Stat } from "@/components/ui";

type Folder = { id: string; name: string; documents: number; chunks: number };
type Doc = {
  id: string; title: string; file_type: string; status: string; chunk_count: number;
  uploaded_at: string; folder_id: string | null; folder_name: string;
};

export default function Dashboard() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [unfiled, setUnfiled] = useState(0);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [folder, setFolder] = useState("all");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [newFolder, setNewFolder] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFolders = useCallback(async () => {
    const [f, s] = await Promise.all([api("/api/folders"), api("/api/stats")]);
    setFolders(f.folders);
    setUnfiled(f.unfiled);
    setTotals(s.totals);
  }, []);

  const loadDocs = useCallback(async () => {
    const p = new URLSearchParams({ folder, sort });
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    const d = await api(`/api/documents?${p}`);
    setDocs(d.documents);
  }, [folder, q, status, sort]);

  useEffect(() => { loadFolders().catch((e) => setError(e.message)); }, [loadFolders]);
  useEffect(() => {
    const t = setTimeout(() => loadDocs().catch((e) => setError(e.message)), 200);
    return () => clearTimeout(t);
  }, [loadDocs]);

  const run = async (fn: () => Promise<any>, msg?: string) => {
    setError(""); setNotice("");
    try {
      await fn();
      if (msg) setNotice(msg);
      await Promise.all([loadFolders(), loadDocs()]);
    } catch (e: any) { setError(e.message); }
  };

  const current = folders.find((f) => f.id === folder);

  return (
    <div>
      <PageHeader
        title="Your notes"
        sub="Folders, documents and their processing status."
        action={<Link href="/upload" className="btn-primary">Upload notes</Link>}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Documents" value={totals?.documents ?? "–"} />
        <Stat label="Chunks embedded" value={totals?.chunks ?? "–"} />
        <Stat label="Folders" value={totals?.folders ?? "–"} />
        <Stat label="Searches" value={totals?.searches ?? "–"} />
      </div>

      <div className="mb-4 space-y-2">
        <Alert>{error}</Alert>
        <Alert kind="ok">{notice}</Alert>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        <aside className="card h-fit p-3">
          <div className="label px-2 pt-1">Folders</div>
          <ul className="space-y-0.5 text-sm">
            {[{ id: "all", name: "All documents", documents: (totals?.documents ?? 0) as number },
              { id: "unfiled", name: "Unfiled", documents: unfiled },
              ...folders].map((f) => (
              <li key={f.id}>
                <button
                  onClick={() => setFolder(f.id)}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left ${
                    folder === f.id ? "bg-accent-soft font-medium text-accent" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="truncate">{f.name}</span>
                  <span className="text-xs tabular-nums text-slate-400">{f.documents}</span>
                </button>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2 border-t border-slate-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => api("/api/folders", { method: "POST", json: { name: newFolder } }), `Folder “${newFolder}” created`)
                .then(() => setNewFolder(""));
            }}
          >
            <input className="input py-1.5" placeholder="New folder" value={newFolder} onChange={(e) => setNewFolder(e.target.value)} />
            <button className="btn-ghost px-2.5 py-1.5" aria-label="Create folder">+</button>
          </form>
          {current && (
            <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
              <button
                className="btn-ghost flex-1 px-2 py-1 text-xs"
                onClick={() => {
                  const name = prompt("Rename folder", current.name);
                  if (name) run(() => api(`/api/folders/${current.id}`, { method: "PATCH", json: { name } }), "Folder renamed");
                }}
              >Rename</button>
              <button
                className="btn-danger flex-1 px-2 py-1 text-xs"
                onClick={() => {
                  if (confirm(`Delete “${current.name}”? Its documents become Unfiled.`))
                    run(() => api(`/api/folders/${current.id}`, { method: "DELETE" }), "Folder deleted").then(() => setFolder("all"));
                }}
              >Delete</button>
            </div>
          )}
        </aside>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
            <input className="input max-w-xs py-1.5" placeholder="Filter by title" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-auto py-1.5" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="">Any status</option>
              <option value="ready">Ready</option>
              <option value="pending">Pending</option>
            </select>
            <select className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title A–Z</option>
              <option value="chunks">Most chunks</option>
            </select>
            {folder !== "all" && docs.length > 0 && (
              <select
                className="input ml-auto w-auto py-1.5"
                value=""
                aria-label="Move all"
                onChange={(e) => {
                  const to = e.target.value === "unfiled" ? null : e.target.value;
                  const from = folder === "unfiled" ? null : folder;
                  run(async () => {
                    const r = await api("/api/folders/reassign", { method: "POST", json: { fromFolderId: from, toFolderId: to } });
                    setNotice(`Moved ${r.moved} document(s)`);
                  });
                }}
              >
                <option value="" disabled>Move all to…</option>
                {folder !== "unfiled" && <option value="unfiled">Unfiled</option>}
                {folders.filter((f) => f.id !== folder).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            )}
          </div>

          {docs.length === 0 ? (
            <Empty title="No documents here yet">
              <Link href="/upload" className="text-accent hover:underline">Upload a PDF or text note</Link> to get started.
            </Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr><th className="th">Title</th><th className="th">Status</th><th className="th">Chunks</th><th className="th">Folder</th><th className="th">Uploaded</th><th className="th" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <Link href={`/documents/${d.id}`} className="font-medium hover:text-accent">{d.title}</Link>
                        <span className="ml-2 text-xs uppercase text-slate-400">{d.file_type}</span>
                      </td>
                      <td className="td"><Badge tone={d.status}>{d.status}</Badge></td>
                      <td className="td tabular-nums">{d.chunk_count}</td>
                      <td className="td">
                        <select
                          className="input w-auto py-1 text-xs"
                          value={d.folder_id ?? ""}
                          aria-label={`Folder for ${d.title}`}
                          onChange={(e) => run(() => api(`/api/documents/${d.id}`, { method: "PATCH", json: { folderId: e.target.value || null } }), "Document moved")}
                        >
                          <option value="">Unfiled</option>
                          {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                      </td>
                      <td className="td whitespace-nowrap text-slate-500">{fmtDate(d.uploaded_at)}</td>
                      <td className="td text-right">
                        <button
                          className="text-xs text-red-600 hover:underline"
                          onClick={() => confirm(`Delete “${d.title}” and its chunks?`) &&
                            run(() => api(`/api/documents/${d.id}`, { method: "DELETE" }), "Document deleted")}
                        >Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
